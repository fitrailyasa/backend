/**
 * Sliding-window behaviour of the failed-login counters (deterministic thanks
 * to fake timers), mirroring `_SECURITY_SPEC.md` section 1.
 */
const { evaluate, recordFailure, reset, resetLoginRateLimits, normalizeEmail } = require('./login-rate-limit.store');

const LIMITS = {
  emailMax: 3,
  emailWindowMs: 900000,
  ipMax: 10,
  ipWindowMs: 900000,
};

const WINDOW_S = LIMITS.emailWindowMs / 1000;

describe('login-rate-limit.store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetLoginRateLimits();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('normalizes emails with trim + lowercase', () => {
    expect(normalizeEmail('  Admin@X.com ')).toBe('admin@x.com');
    expect(normalizeEmail(undefined)).toBe('');
  });

  it('locks once the email counter reaches its max and reports Retry-After >= 1', () => {
    recordFailure('a@x.com', '1.1.1.1');
    recordFailure('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS)).toEqual({ locked: false, retryAfterSeconds: 0 });

    recordFailure('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS)).toEqual({
      locked: true,
      retryAfterSeconds: WINDOW_S,
    });
  });

  it('slides: failures older than the window no longer count', () => {
    for (let i = 0; i < 3; i += 1) recordFailure('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(true);

    jest.advanceTimersByTime(LIMITS.emailWindowMs + 1);
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(false);
  });

  it('keeps a second email usable while the first one is locked', () => {
    for (let i = 0; i < 3; i += 1) recordFailure('a@x.com', '1.1.1.1');

    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(true);
    expect(evaluate('b@x.com', '1.1.1.1', LIMITS).locked).toBe(false);
  });

  it('locks the IP after ipMax failures spread over different emails', () => {
    for (let i = 0; i < LIMITS.ipMax; i += 1) recordFailure(`user${i}@x.com`, '2.2.2.2');

    expect(evaluate('fresh@x.com', '2.2.2.2', LIMITS).locked).toBe(true);
    expect(evaluate('fresh@x.com', '3.3.3.3', LIMITS).locked).toBe(false);
  });

  it('a successful login clears the email bucket and its own IP failures', () => {
    for (let i = 0; i < 3; i += 1) recordFailure('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(true);

    reset('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(false);

    // three fresh failures are allowed again after the reset
    for (let i = 0; i < 3; i += 1) recordFailure('a@x.com', '1.1.1.1');
    expect(evaluate('a@x.com', '1.1.1.1', LIMITS).locked).toBe(true);
  });

  it('resetLoginRateLimits clears everything', () => {
    for (let i = 0; i < LIMITS.ipMax; i += 1) recordFailure(`user${i}@x.com`, '2.2.2.2');

    resetLoginRateLimits();
    expect(evaluate('user0@x.com', '2.2.2.2', LIMITS).locked).toBe(false);
  });
});
