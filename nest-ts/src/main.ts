import { readFileSync } from 'fs';
import { join } from 'path';
import { ClassSerializerInterceptor, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createRateLimitMiddleware } from './common/security/rate-limit.middleware';
import { createSecurityHeadersMiddleware } from './common/security/security-headers.middleware';
import { VALIDATION_PIPE_OPTIONS } from './common/utils/validation-errors';

const DOCS_BASE_PATH = '/api/v1/docs';
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200'];

/**
 * `TRUST_PROXY=false` (default) keeps `X-Forwarded-For` out of `req.ip` so the
 * rate limiters cannot be spoofed; `true`, a hop count or an IP list is handed
 * to Express as-is when the API really runs behind a reverse proxy.
 */
const parseTrustProxy = (value: string | undefined): boolean | number | string => {
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
const resolveCorsOptions = (config: ConfigService) => {
  const raw =
    config.get<string>('CORS_ORIGINS') ??
    config.get<string>('CORS_ORIGIN') ??
    DEFAULT_CORS_ORIGINS.join(',');
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowAll = origins.includes('*');

  return {
    origin: allowAll ? true : origins,
    credentials: !allowAll,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600, // preflight cache
  };
};

export async function setupApp(app: INestApplication): Promise<INestApplication> {
  const config = app.get(ConfigService);
  const instance = app.getHttpAdapter().getInstance();

  // Fingerprint removal: no `X-Powered-By`, no `Server` banner.
  instance.disable('x-powered-by');
  instance.set('trust proxy', parseTrustProxy(config.get<string>('TRUST_PROXY')));

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  const reflector = app.get(Reflector);

  app.useGlobalInterceptors(new TransformInterceptor(reflector), new ClassSerializerInterceptor(reflector));

  // Registered first so every later response (429s, 413s, errors) carries the
  // security headers too.
  app.use(
    createSecurityHeadersMiddleware({
      docsBasePath: DOCS_BASE_PATH,
      enableHsts: (config.get<string>('ENABLE_HSTS') ?? 'false').toLowerCase() === 'true',
    }),
  );

  app.enableCors(resolveCorsOptions(config));

  // Request body cap (default 100kb) for JSON and form payloads; oversized
  // bodies answer 413 with the standard error envelope.
  const bodyLimit = config.get<string>('BODY_LIMIT') ?? '100kb';
  app.use(json({ limit: bodyLimit }), urlencoded({ extended: true, limit: bodyLimit }));

  // Global rate limit: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS per IP, skipped
  // for /health and automatically disabled when NODE_ENV=test.
  app.use(createRateLimitMiddleware(config));

  const document = JSON.parse(readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8')) as OpenAPIObject;

  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/docs.json',
    customSiteTitle: 'Backend Starter Kit API - NestTS',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list', deepLinking: true },
  });

  return app;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT')) || 3000;

  await setupApp(app);
  await app.listen(port, '0.0.0.0');

  Logger.log(`Listening on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger UI on http://localhost:${port}/api/v1/docs`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
