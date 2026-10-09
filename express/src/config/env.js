import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');

for (const candidate of ['.env', '.env.local']) {
  const full = path.join(rootDir, candidate);
  if (existsSync(full)) dotenv.config({ path: full });
}

const errors = [];

function str(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (fallback === undefined) errors.push(`${key} is required`);
    return fallback;
  }
  return raw;
}

function int(key, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} must be an integer between ${min} and ${max} (received "${raw}")`);
    return fallback;
  }
  return value;
}

function bool(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  errors.push(`${key} must be a boolean value (received "${raw}")`);
  return fallback;
}

function list(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return String(raw)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const nodeEnv = str('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const dialect = String(str('DB_DIALECT', 'mysql')).toLowerCase();
if (!['mysql', 'mariadb', 'sqlite'].includes(dialect)) {
  errors.push(`DB_DIALECT must be one of mysql, mariadb, sqlite (received "${dialect}")`);
}

const jwtSecret = str('JWT_SECRET', isProduction ? undefined : 'insecure-development-secret-key');
if (jwtSecret && jwtSecret.length < 32 && !isTest) {
  errors.push('JWT_SECRET must be at least 32 characters long');
}

const corsOriginRaw = str('CORS_ORIGIN', '*');
const corsOrigin = corsOriginRaw === '*' ? '*' : list('CORS_ORIGIN', []);

if (errors.length > 0) {
  const details = errors.map((entry) => `  - ${entry}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill in the values.`);
}

export const env = Object.freeze({
  rootDir,
  nodeEnv,
  isProduction,
  isTest,
  port: int('PORT', 3000, { min: 0, max: 65535 }),
  host: str('HOST', '0.0.0.0'),
  apiPrefix: str('API_PREFIX', '/api/v1'),
  apiBaseUrl: str('API_BASE_URL', 'http://localhost:3000'),
  corsOrigin,
  bodyLimit: str('BODY_LIMIT', '1mb'),
  logFormat: str('LOG_FORMAT', isTest ? 'tiny' : 'dev'),
  logLevel: str('LOG_LEVEL', 'info'),
  requestIdHeader: str('REQUEST_ID_HEADER', 'X-Request-Id'),

  db: Object.freeze({
    dialect,
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306, { min: 1, max: 65535 }),
    name: str('DB_NAME', 'backend_starter'),
    user: str('DB_USER', 'root'),
    password: str('DB_PASSWORD', ''),
    charset: str('DB_CHARSET', 'utf8mb4'),
    collate: str('DB_COLLATE', 'utf8mb4_unicode_ci'),
    storage: str('DB_STORAGE', path.join(rootDir, 'database', 'dev.sqlite')),
    sync: bool('DB_SYNC', !isProduction),
    syncForce: bool('DB_SYNC_FORCE', false),
    logging: bool('DB_LOGGING', false),
    pool: Object.freeze({
      max: int('DB_POOL_MAX', 10, { min: 1 }),
      min: int('DB_POOL_MIN', 0, { min: 0 }),
      idle: int('DB_POOL_IDLE', 10000, { min: 0 }),
      acquire: int('DB_POOL_ACQUIRE', 30000, { min: 0 }),
    }),
  }),

  jwt: Object.freeze({
    secret: jwtSecret,
    accessSecret: str('JWT_ACCESS_SECRET') || jwtSecret,
    refreshSecret: str('JWT_REFRESH_SECRET') || jwtSecret,
    expiresIn: int('JWT_EXPIRES_IN', 3600, { min: 60 }),
    refreshExpiresIn: int('JWT_REFRESH_EXPIRES_IN', 604800, { min: 300 }),
    issuer: str('JWT_ISSUER', 'backend-starter-express'),
    audience: str('JWT_AUDIENCE', 'backend-starter-clients'),
  }),

  bcryptRounds: int('BCRYPT_ROUNDS', 10, { min: 4, max: 15 }),

  pagination: Object.freeze({
    limit: int('PAGINATION_LIMIT', 10, { min: 1 }),
    maxLimit: int('PAGINATION_MAX_LIMIT', 100, { min: 1 }),
  }),

  rateLimit: Object.freeze({
    windowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    max: int('RATE_LIMIT_MAX', 100, { min: 0 }),
  }),
});

export default env;
