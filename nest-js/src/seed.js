require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { Logger } = require('@nestjs/common');
const { AppModule } = require('./app.module');
const { SeederService } = require('./database/seeder.service');

async function bootstrap() {
  process.env.DB_SEED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const seeder = app.get(SeederService);
  await seeder.seed();
  await app.close();
  Logger.log('Seeding finished successfully.', 'Seed');
}

bootstrap().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
