import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SeederModule } from './seeder.module';
import { TimestampSubscriber } from './timestamp.subscriber';

const toBoolean = (value: string | undefined, fallback = false): boolean =>
  value === undefined || value === '' ? fallback : value.toLowerCase() === 'true';

/**
 * Builds the TypeORM connection options. `mysql` is the production driver, `sqlite`
 * is only used by the test suites so they need no database server.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const dialect = String(config.get<string>('DB_DIALECT') ?? 'mysql').toLowerCase();
  const synchronize = toBoolean(config.get<string>('DB_SYNCHRONIZE'));
  const logging = toBoolean(config.get<string>('DB_LOGGING'));

  if (dialect === 'sqlite') {
    return {
      type: 'better-sqlite3',
      database: config.get<string>('DB_STORAGE') ?? ':memory:',
      autoLoadEntities: true,
      synchronize,
      logging,
      subscribers: [TimestampSubscriber],
    };
  }

  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST') ?? 'localhost',
    port: Number(config.get<string>('DB_PORT')) || 3306,
    username: config.get<string>('DB_USERNAME') ?? 'root',
    password: config.get<string>('DB_PASSWORD') ?? '',
    database: config.get<string>('DB_DATABASE') ?? 'nest_ts_starter',
    autoLoadEntities: true,
    synchronize,
    logging,
    subscribers: [TimestampSubscriber],
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    SeederModule,
  ],
})
export class DatabaseModule {}
