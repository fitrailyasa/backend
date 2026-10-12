/**
 * Global per-IP request limiter (`_SECURITY_SPEC.md` section 2). It is off in
 * the e2e suites (NODE_ENV=test), so its behaviour is covered here directly.
 */
const { createRateLimitMiddleware } = require('./rate-limit.middleware');

const configOf = (values) => ({
  get: (key, fallback) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback),
});

const run = (middleware, { path = '/products', ip = '1.2.3.4' } = {}) => {
  const captured = { passed: false, status: undefined, body: undefined, headers: {} };
  const request = { path, ip, socket: { remoteAddress: ip } };
  const response = {
    status: (code) => {
      captured.status = code;
      return response;
    },
    set: (name, value) => {
      captured.headers[name] = value;
      return response;
    },
    json: (body) => {
      captured.body = body;
      return response;
    },
  };

  middleware(request, response, () => {
    captured.passed = true;
  });

  return captured;
};

const ENABLED = {
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
    expect(blocked.body.errors).toBeUndefined();
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
