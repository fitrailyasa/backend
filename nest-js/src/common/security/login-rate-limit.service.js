const { Injectable, Inject } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const store = require('./login-rate-limit.store');

/** Body (without `errors`) of the 429 returned while an account or IP is locked. */
const LOGIN_LOCKED_MESSAGE = 'Too many failed login attempts. Please try again later.';

const DEFAULTS = {
  emailMax: 3,
  emailWindowMs: 900000, // 15 minutes
  ipMax: 10,
  ipWindowMs: 900000, // 15 minutes
};

/**
 * Failed-login limiter (see `_SECURITY_SPEC.md` section 1).
 *
 * The counters live in `login-rate-limit.store` (module scope), so the
 * exported `resetLoginRateLimits()` clears them no matter which instance
 * resolved the service.
 */
@Injectable()
class LoginRateLimitService {
  @Inject(ConfigService)
  config;

  limits() {
    return {
      emailMax: Number(this.config.get('LOGIN_RATE_LIMIT_MAX', DEFAULTS.emailMax)),
      emailWindowMs: Number(this.config.get('LOGIN_RATE_LIMIT_WINDOW_MS', DEFAULTS.emailWindowMs)),
      ipMax: Number(this.config.get('LOGIN_IP_RATE_LIMIT_MAX', DEFAULTS.ipMax)),
      ipWindowMs: Number(this.config.get('LOGIN_IP_RATE_LIMIT_WINDOW_MS', DEFAULTS.ipWindowMs)),
    };
  }

  /** Is this (email, ip) pair locked out? Call this **before** verifying the password. */
  check(email, ip) {
    return store.evaluate(email, ip, this.limits());
  }

  /** Records a failed credential check (unknown email or wrong password alike). */
  recordFailure(email, ip) {
    store.sweep(this.limits());
    store.recordFailure(email, ip);
  }

  /** Clears the counters of a successful login. */
  reset(email, ip) {
    store.reset(email, ip);
  }
}

/** Test hook used from `tests/setup-env.js` and the lockout suites. */
const resetLoginRateLimits = () => store.resetLoginRateLimits();

module.exports = { LoginRateLimitService, LOGIN_LOCKED_MESSAGE, resetLoginRateLimits };
