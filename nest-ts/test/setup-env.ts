import { resetLoginRateLimits } from '../src/common/security/login-rate-limit.service';

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_LOGGING = 'false';
process.env.DB_SEED = 'false';
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-1234567890';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '3600';
process.env.BCRYPT_SALT_ROUNDS = '4';
// CORS allowlist (never `*` together with credentials), same defaults as production.
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173,http://localhost:4200';

// The failed-login counters live in process memory: clear them so every test
// suite starts from a clean slate (the global rate limit is off in tests).
resetLoginRateLimits();
