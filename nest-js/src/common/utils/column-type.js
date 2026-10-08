const isSqlite = () => String(process.env.DB_DIALECT || 'mysql').toLowerCase() === 'sqlite';

/**
 * MySQL/MariaDB gets a native ENUM column; SQLite has no ENUM type so it falls back to VARCHAR.
 */
const enumColumnType = () => (isSqlite() ? 'varchar' : 'enum');

/**
 * DECIMAL(12,2) columns come back as strings from the MySQL driver, normalise them to numbers.
 */
const decimalTransformer = {
  to: (value) => value,
  from: (value) => (value === null || value === undefined ? value : Number(value)),
};

/**
 * SQLite only allows AUTOINCREMENT on an INTEGER primary key, MySQL keeps BIGINT UNSIGNED.
 */
const primaryGeneratedType = () => (isSqlite() ? 'integer' : 'bigint');

module.exports = { isSqlite, enumColumnType, decimalTransformer, primaryGeneratedType };
