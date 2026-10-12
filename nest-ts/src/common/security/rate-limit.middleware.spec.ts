/**
 * Global per-IP request limiter (`_SECURITY_SPEC.md` section 2). It is off in
 * the e2e suites (NODE_ENV=test), so its behaviour is covered here directly.
 */
import type { NextFunction, Request, Response } from 'express';
import { createRateLimitMiddleware, type RateLimitConfig } from './rate-limit.middleware';

const configOf = (values: Record<string, string>): RateLimitConfig => ({
  get: (key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined,
});

interface Captured {
  passed: boolean;
  status?: number;
  body?: { success: boolean; message: string; errors?: unknown };
  headers: Record<string, string>;
}

const run = (
  middleware: (request: Request, response: Response, next: NextFunction) => void,
  { path = '/products', ip = '1.2.3.4' }: { path?: string; ip?: string } = {},
): Captured => {
  const captured: Captured = { passed: false, headers: {} };
  const request = { path, ip, socket: { remoteAddress: ip } } as unknown as Request;
  const response = {
    status: (code: number) => {
      captured.status = code;
      return response;
    },
    set: (name: string, value: string) => {
      captured.headers[name] = value;
      return response;
    },
    json: (body: Captured['body']) => {
      captured.body = body;
      return response;
    },
  } as unknown as Response;

  middleware(request, response, () => {
    captured.passed = true;
  });

  return captured;
};

const ENABLED: Record<string, string> = {
  NODE_ENV: 'production',
  RATE_LIMIT_ENABLED: 'true',
  RATE_LIMIT_MAX: '3',
  RATE_LIMIT_WINDOW_MS: '60000',
};

describe('createRateLimitMiddleware', () => {
  it('lets MAX requests through, then answers 429 with Retry-After and the envelope', () => {
    const middleware = createRateLimitMiddleware(configOf(ENABLED));

    for (let i = 0; i < 3; i += 1) expect(run(middleware).passed).toBe(true);

    const blocked = run(middleware);
    expect(blocked.passed).toBe(false);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    expect(blocked.body).toEqual({ success: false, message: 'Too many requests' });
    expect(blocked.body?.errors).toBeUndefined();
  });

  it('never counts or limits /health', () => {
    const middleware = createRateLimitMiddleware(configOf(ENABLED));

    for (let i = 0; i < 10; i += 1) expect(run(middleware, { path: '/health' }).passed).toBe(true);
  });

  it('counts per IP', () => {
    const middleware = createRateLimitMiddleware(configOf(ENABLED));

    for (let i = 0; i < 3; i += 1) run(middleware, { ip: '9.9.9.9' });

    expect(run(middleware, { ip: '9.9.9.9' }).passed).toBe(false);
    expect(run(middleware, { ip: '8.8.8.8' }).passed).toBe(true);
  });

  it('forgets expired timestamps so the window slides', () => {
    jest.useFakeTimers();
    try {
      const middleware = createRateLimitMiddleware(configOf(ENABLED));

      for (let i = 0; i < 3; i += 1) run(middleware);
      expect(run(middleware).passed).toBe(false);

      jest.advanceTimersByTime(60001);
      expect(run(middleware).passed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('is disabled by default in the test env and when RATE_LIMIT_ENABLED=false', () => {
    const inTests = createRateLimitMiddleware(
      configOf({ NODE_ENV: 'test', RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '60000' }),
    );
    for (let i = 0; i < 5; i += 1) expect(run(inTests).passed).toBe(true);

    const switchedOff = createRateLimitMiddleware(
      configOf({ NODE_ENV: 'production', RATE_LIMIT_ENABLED: 'false', RATE_LIMIT_MAX: '1' }),
    );
    for (let i = 0; i < 5; i += 1) expect(run(switchedOff).passed).toBe(true);
  });
});
