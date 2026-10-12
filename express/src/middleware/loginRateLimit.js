import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

// Sliding-window counters for failed login attempts, kept in process memory.
// Failed *credential checks* only (unknown email and wrong password alike),
// keyed on the normalized email and on the client IP. Expired timestamps are
// pruned on every check so the stores cannot grow forever.
const emailFailures = new Map();
const ipFailures = new Map();
const PRUNE_THRESHOLD = 5000;

export function normalizeLoginEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function currentFailures(store, key, windowMs, now) {
  if (!key) return [];
  const bucket = store.get(key);
  if (!bucket) return [];
  const cutoff = now - windowMs;
  let firstActive = 0;
  while (firstActive < bucket.length && bucket[firstActive] <= cutoff) firstActive += 1;
  const active = firstActive > 0 ? bucket.slice(firstActive) : bucket;
  if (active.length === 0) store.delete(key);
  else if (active !== bucket) store.set(key, active);
  return active;
}

function lockedRetryAfter(active, max, windowMs, now) {
  if (active.length < max) return 0;
  const oldest = active[0];
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

function pushFailure(store, key, windowMs, now) {
  if (!key) return;
  const active = currentFailures(store, key, windowMs, now);
  active.push(now);
  store.set(key, active);
}

function pruneStores(now) {
  if (emailFailures.size <= PRUNE_THRESHOLD && ipFailures.size <= PRUNE_THRESHOLD) return;
  for (const key of [...emailFailures.keys()]) {
    currentFailures(emailFailures, key, env.loginRateLimit.windowMs, now);
  }
  for (const key of [...ipFailures.keys()]) {
    currentFailures(ipFailures, key, env.loginRateLimit.ipWindowMs, now);
  }
}

export function recordLoginFailure({ email, ip } = {}) {
  const now = Date.now();
  pushFailure(emailFailures, email, env.loginRateLimit.windowMs, now);
  pushFailure(ipFailures, ip, env.loginRateLimit.ipWindowMs, now);
}

export function clearLoginFailures(email) {
  const key = normalizeLoginEmail(email);
  if (key) emailFailures.delete(key);
}

export function resetLoginRateLimits() {
  emailFailures.clear();
  ipFailures.clear();
}

export default function loginRateLimit() {
  return function limiter(req, res, next) {
    const now = Date.now();
    const email = normalizeLoginEmail(req.body?.email);
    const ip = clientIp(req);

    pruneStores(now);

    const activeEmail = currentFailures(emailFailures, email, env.loginRateLimit.windowMs, now);
    const activeIp = currentFailures(ipFailures, ip, env.loginRateLimit.ipWindowMs, now);

    const emailRetryAfter = lockedRetryAfter(activeEmail, env.loginRateLimit.max, env.loginRateLimit.windowMs, now);
    const ipRetryAfter = lockedRetryAfter(activeIp, env.loginRateLimit.ipMax, env.loginRateLimit.ipWindowMs, now);

    if (emailRetryAfter > 0 || ipRetryAfter > 0) {
      const retryAfter = Math.max(emailRetryAfter, ipRetryAfter);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(env.loginRateLimit.max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + retryAfter * 1000) / 1000)));
      return next(ApiError.tooManyRequests('Too many failed login attempts. Please try again later.'));
    }

    // The controller records failures and clears the counter through this handle.
    req.loginAttempt = { email, ip };
    return next();
  };
}
