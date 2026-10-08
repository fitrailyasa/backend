require('reflect-metadata');

const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule } = require('@nestjs/swagger');
const { ValidationPipe, Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('./app.module');
const { VALIDATION_PIPE_OPTIONS } = require('./common/utils/validation-errors');

async function setupApp(app) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.get('API_PREFIX', 'api/v1'), {
    exclude: ['health'],
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));

  const allowedOrigins = String(config.get('CORS_ORIGIN', '*'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes('*');

  app.enableCors({
    origin: allowAll ? true : allowedOrigins,
    credentials: !allowAll,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const document = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.json'), 'utf8'));

  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: 'api/v1/docs.json',
    customSiteTitle: 'Backend Starter Kit API',
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

module.exports = { setupApp, bootstrap };
