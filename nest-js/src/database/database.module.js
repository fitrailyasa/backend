const { join } = require('path');
const { Module } = require('@nestjs/common');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { ConfigModule, ConfigService } = require('@nestjs/config');

const { TimestampSubscriber } = require('./timestamp.subscriber');

const ENTITIES = [join(__dirname, '..', '**', '*.entity{.js,.ts}')];

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Builds the TypeORM connection options. `mysql` is the production driver, `sqlite`
 * is only used by the smoke tests and the e2e suite so the suite needs no server.
 */
const buildTypeOrmOptions = (config) => {
  const dialect = String(config.get('DB_DIALECT', 'mysql')).toLowerCase();
  const synchronize = toBoolean(config.get('DB_SYNCHRONIZE'), false);

  if (dialect === 'sqlite') {
    return {
      type: 'better-sqlite3',
      database: config.get('DB_STORAGE', ':memory:'),
      entities: ENTITIES,
      synchronize,
      logging: toBoolean(config.get('DB_LOGGING'), false),
    };
  }

  return {
    type: 'mysql',
    host: config.get('DB_HOST', '127.0.0.1'),
    port: toNumber(config.get('DB_PORT'), 3306),
    username: config.get('DB_USERNAME', 'root'),
    password: config.get('DB_PASSWORD', ''),
    database: config.get('DB_NAME', 'backend_starter'),
    charset: config.get('DB_CHARSET', 'utf8mb4'),
    entities: ENTITIES,
    synchronize,
    subscribers: [TimestampSubscriber],
    logging: toBoolean(config.get('DB_LOGGING'), false),
    timezone: 'Z',
    extra: { connectionLimit: toNumber(config.get('DB_POOL_SIZE'), 10) },
  };
};

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config) => buildTypeOrmOptions(config),
    }),
  ],
})
class DatabaseModule {}

module.exports = { DatabaseModule, buildTypeOrmOptions };
