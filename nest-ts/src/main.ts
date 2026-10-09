import { readFileSync } from 'fs';
import { join } from 'path';
import { ClassSerializerInterceptor, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { VALIDATION_PIPE_OPTIONS } from './common/utils/validation-errors';

export async function setupApp(app: INestApplication): Promise<INestApplication> {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  const reflector = app.get(Reflector);

  app.useGlobalInterceptors(new TransformInterceptor(reflector), new ClassSerializerInterceptor(reflector));

  const allowedOrigins = (config.get<string>('CORS_ORIGIN') ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowAll = allowedOrigins.includes('*');

  app.enableCors({
    origin: allowAll ? true : allowedOrigins,
    credentials: !allowAll,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

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
