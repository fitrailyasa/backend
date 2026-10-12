require('reflect-metadata');

const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule } = require('@nestjs/swagger');
const { ValidationPipe, Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { json, urlencoded } = require('express');
const { AppModule } = require('./app.module');
const { VALIDATION_PIPE_OPTIONS } = require('./common/utils/validation-errors');
const { createSecurityHeadersMiddleware } = require('./common/security/security-headers.middleware');
const { createRateLimitMiddleware } = require('./common/security/rate-limit.middleware');

const DOCS_BASE_PATH = '/api/v1/docs';
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200'];

/**
 * `TRUST_PROXY=false` (default) keeps `X-Forwarded-For` out of `req.ip` so the
 * rate limiters cannot be spoofed; `true`, a hop count or an IP list is handed
 * to Express as-is when the API really runs behind a reverse proxy.
 */
const parseTrustProxy = (value) => {
  const raw = String(value ?? 'false').trim().toLowerCase();
  if (raw === '' || raw === 'false' || raw === '0') return false;
  if (raw === 'true') return true;
  if (/^\d+$/.test(raw)) return Number(raw);
  return String(value).trim();
};

/**
 * CORS allowlist from `CORS_ORIGINS` (legacy `CORS_ORIGIN` still honoured).
 * `*` is never combined with credentials: when it is requested the origin is
 * reflected but `Access-Control-Allow-Credentials` stays off.
 */
const resolveCorsOptions = (config) => {
  const raw =
    config.get('CORS_ORIGINS') || config.get('CORS_ORIGIN') || DEFAULT_CORS_ORIGINS.join(',');
  const origins = String(raw)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAll = origins.includes('*');

  return {
    origin: allowAll ? true : origins,
    credentials: !allowAll,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600, // preflight cache
  };
};

async function setupApp(app) {
  const config = app.get(ConfigService);
  const instance = app.getHttpAdapter().getInstance();

  // Fingerprint removal: no `X-Powered-By`, no `Server` banner.
  instance.disable('x-powered-by');
  instance.set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY', 'false')));

  app.setGlobalPrefix(config.get('API_PREFIX', 'api/v1'), {
    exclude: ['health'],
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));

  // Registered first so every later response (429s, 413s, errors) carries the
  // security headers too.
  app.use(
    createSecurityHeadersMiddleware({
      docsBasePath: DOCS_BASE_PATH,
      enableHsts: String(config.get('ENABLE_HSTS', 'false')).toLowerCase() === 'true',
    }),
  );

  app.enableCors(resolveCorsOptions(config));

  // Request body cap (default 100kb) for JSON and form payloads; oversized
  // bodies answer 413 with the standard error envelope.
  const bodyLimit = String(config.get('BODY_LIMIT', '100kb'));
  app.use(json({ limit: bodyLimit }), urlencoded({ extended: true, limit: bodyLimit }));

  // Global rate limit: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS per IP, skipped
  // for /health and automatically disabled when NODE_ENV=test.
  app.use(createRateLimitMiddleware(config));

  const document = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.json'), 'utf8'));

  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/docs.json',
    customSiteTitle: 'Backend Starter Kit API - NestJS',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list', deepLinking: true },
  });

  return app;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const port = Number(config.get('PORT', 3000));

  await setupApp(app);
  await app.listen(port, '0.0.0.0');

  Logger.log(`Listening on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger UI on http://localhost:${port}/api/docs`, 'Bootstrap');
}

if (require.main === module) {
  bootstrap();
}

module.exports = { setupApp, bootstrap, resolveCorsOptions, parseTrustProxy };
