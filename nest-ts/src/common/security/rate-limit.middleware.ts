import type { NextFunction, Request, Response } from 'express';

/**
 * Global per-IP request limiter (`_SECURITY_SPEC.md` section 2):
 * `RATE_LIMIT_MAX` requests / `RATE_LIMIT_WINDOW_MS` per client IP on every
 * route except `/health`.
 *
 * Registered as Express middleware in `setupApp`, so it also covers requests
 * that never reach a controller. It is skipped automatically when
 * `NODE_ENV=test` (so suites never flake) or when `RATE_LIMIT_ENABLED=false`.
 * Over-limit requests get 429 with `Retry-After` and the standard error
 * envelope. Counters are per process.
 */

/** The one ConfigService method this middleware needs (keeps tests free of a whole config). */
export interface RateLimitConfig {
  get(key: string): string | undefined;
}

export type RateLimitMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => void;

export const createRateLimitMiddleware = (config: RateLimitConfig): RateLimitMiddleware => {
  const hits = new Map<string, number[]>(); // ip -> [timestamp, ...]

  const isEnabled = (): boolean => {
    const flag = (config.get('RATE_LIMIT_ENABLED') ?? 'true').toLowerCase();
    if (flag === 'false' || flag === '0') return false;
    return (config.get('NODE_ENV') ?? '').toLowerCase() !== 'test';
  };

  const prune = (list: number[], windowMs: number, now: number): number[] => {
    let expired = 0;
    while (expired < list.length && list[expired] + windowMs <= now) expired += 1;
    if (expired > 0) list.splice(0, expired);
    return list;
  };

  return function globalRateLimit(request, response, next) {
    if (!isEnabled()) return next();

    const pathname = request.path || String(request.url ?? '').split('?')[0];
    if (pathname === '/health') return next();

    const max = Number(config.get('RATE_LIMIT_MAX') ?? 300);
    const windowMs = Number(config.get('RATE_LIMIT_WINDOW_MS') ?? 60000);
    const now = Date.now();
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';

    // Prune every bucket so abandoned IPs cannot leak memory.
    for (const [key, list] of hits) {
      prune(list, windowMs, now);
      if (list.length === 0) hits.delete(key);
    }

    let list = hits.get(ip);
    if (!list) {
      list = [];
      hits.set(ip, list);
    }

    if (list.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000));
      response.status(429);
      response.set('Retry-After', String(retryAfter));
      response.json({ success: false, message: 'Too many requests' });
      return;
    }

    list.push(now);
    next();
  };
};
