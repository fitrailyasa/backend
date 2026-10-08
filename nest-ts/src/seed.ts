import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeederService } from './database/seeder.service';

async function bootstrap() {
  process.env.DB_SEED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const seeder = app.get(SeederService);
  await seeder.seed();
  await app.close();
  Logger.log('Seeding finished successfully.', 'Seed');
}

void bootstrap();
