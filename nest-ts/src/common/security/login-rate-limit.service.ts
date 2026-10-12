import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  evaluate,
  recordFailure,
  reset,
  resetLoginRateLimits as clearStore,
  sweep,
  type LoginEvaluation,
  type LoginLimits,
} from './login-rate-limit.store';

/** Body (without `errors`) of the 429 returned while an account or IP is locked. */
export const LOGIN_LOCKED_MESSAGE = 'Too many failed login attempts. Please try again later.';

const DEFAULTS: LoginLimits = {
  emailMax: 3,
  emailWindowMs: 900000, // 15 minutes
  ipMax: 10,
  ipWindowMs: 900000, // 15 minutes
};

const readNumber = (config: ConfigService, key: string, fallback: number): number => {
  const value = Number(config.get<string>(key));

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Failed-login limiter (see `_SECURITY_SPEC.md` section 1).
 *
 * The counters live in `login-rate-limit.store` (module scope), so the
 * exported `resetLoginRateLimits()` clears them no matter which instance
 * resolved the service.
 */
@Injectable()
export class LoginRateLimitService {
  constructor(private readonly config: ConfigService) {}

  limits(): LoginLimits {
    return {
      emailMax: readNumber(this.config, 'LOGIN_RATE_LIMIT_MAX', DEFAULTS.emailMax),
      emailWindowMs: readNumber(this.config, 'LOGIN_RATE_LIMIT_WINDOW_MS', DEFAULTS.emailWindowMs),
      ipMax: readNumber(this.config, 'LOGIN_IP_RATE_LIMIT_MAX', DEFAULTS.ipMax),
      ipWindowMs: readNumber(this.config, 'LOGIN_IP_RATE_LIMIT_WINDOW_MS', DEFAULTS.ipWindowMs),
    };
  }

  /** Is this (email, ip) pair locked out? Call this **before** verifying the password. */
  check(email: string, ip: string): LoginEvaluation {
    return evaluate(email, ip, this.limits());
  }

  /** Records a failed credential check (unknown email or wrong password alike). */
  recordFailure(email: string, ip: string): void {
    sweep(this.limits());
    recordFailure(email, ip);
  }

  /** Clears the counters of a successful login. */
  reset(email: string, ip: string): void {
    reset(email, ip);
  }
}

/** Test hook used from `test/setup-env.ts` and the lockout suites. */
export const resetLoginRateLimits = (): void => clearStore();
