import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export default function rateLimit({ windowMs = env.authRateLimit.windowMs, max = env.authRateLimit.max, key, skip } = {}) {
  if (max <= 0) return (req, res, next) => next();

  const hits = new Map();

  const resolveKey = key ?? ((req) => req.ip || req.socket?.remoteAddress || 'unknown');

  return function limiter(req, res, next) {
    if (skip?.(req)) return next();

    const id = resolveKey(req);
    const now = Date.now();
    const entry = hits.get(id);

    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }

    const current = hits.get(id);
    const remaining = Math.max(0, max - current.count);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (hits.size > 5000) {
      for (const [entryKey, value] of hits) {
        if (value.resetAt <= now) hits.delete(entryKey);
      }
    }

    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return next(ApiError.tooManyRequests('Too many requests, please try again later'));
    }

    return next();
  };
}
