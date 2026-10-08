import fs from 'node:fs';
import path from 'node:path';
import { Sequelize, DataTypes } from 'sequelize';
import env from './env.js';
import sqliteDriver from './sqlite-driver.js';

const { db } = env;
const isSqlite = db.dialect === 'sqlite';
const isMySqlFamily = db.dialect === 'mysql' || db.dialect === 'mariadb';

const common = {
  dialect: db.dialect,
  logging: db.logging ? (sql, timing) => console.log(`[sql] ${sql}`, timing ?? '') : false,
  define: {
    underscored: true,
    freezeTableName: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    charset: db.charset,
    collate: db.collate,
  },
  pool: {
    max: db.pool.max,
    min: db.pool.min,
    idle: db.pool.idle,
    acquire: db.pool.acquire,
  },
  retry: { max: 2 },
  benchmark: false,
};

let options;

if (isSqlite) {
  const storage = db.storage === ':memory:' ? ':memory:' : path.resolve(env.rootDir, db.storage);
  if (storage !== ':memory:') {
    fs.mkdirSync(path.dirname(storage), { recursive: true });
  }
  options = {
    ...common,
    dialectModule: sqliteDriver,
    storage,
    logging: common.logging,
    pool: { max: 1, min: 0, idle: db.pool.idle, acquire: db.pool.acquire },
  };
} else {
  options = {
    ...common,
    host: db.host,
    port: db.port,
    database: db.name,
    username: db.user,
    password: db.password,
    dialectOptions: {
      charset: db.charset,
      supportBigNumbers: true,
      bigNumberStrings: false,
      dateStrings: false,
    },
    timezone: '+00:00',
  };
}

export const sequelize = new Sequelize(options);

export const dialectName = sequelize.getDialect();
export const isProductionDialect = isMySqlFamily;

/**
 * BIGINT UNSIGNED is the canonical primary/foreign key type from the spec.
 * SQLite has no UNSIGNED modifier, so it degrades to a plain BIGINT there.
 */
export const idType = isMySqlFamily ? DataTypes.BIGINT.UNSIGNED : DataTypes.BIGINT;

export const FK = (model, key = 'id', onDelete = 'CASCADE') => ({
  allowNull: false,
  type: idType,
  references: { model, key },
  onDelete,
  onUpdate: 'CASCADE',
});

export async function connectDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

export async function syncDatabase({ force = false } = {}) {
  if (force && isMySqlFamily) {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  }
  try {
    await sequelize.sync({ force });
  } finally {
    if (force && isMySqlFamily) {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }
  return sequelize;
}

export async function disconnectDatabase() {
  await sequelize.close();
}

export default sequelize;
