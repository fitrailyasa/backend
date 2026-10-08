import { ValueTransformer } from 'typeorm';

/** True when the app runs on SQLite, which is only used by the test suites. */
export function isSqlite(): boolean {
  return String(process.env.DB_DIALECT ?? 'mysql').toLowerCase() === 'sqlite';
}

/**
 * SQLite only allows AUTOINCREMENT on an INTEGER primary key, MySQL keeps BIGINT UNSIGNED.
 */
export function primaryGeneratedType(): 'bigint' | 'integer' {
  return isSqlite() ? 'integer' : 'bigint';
}

/**
 * MySQL/MariaDB gets a native ENUM column; SQLite has no ENUM type so it falls
 * back to VARCHAR and relies on the application to validate the value.
 */
export function enumColumnType(): 'enum' | 'varchar' {
  return isSqlite() ? 'varchar' : 'enum';
}

/** DECIMAL(12,2) columns come back as strings from the MySQL driver, normalise them to numbers. */
export const decimalTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value): number | null => (value === null || value === undefined ? value : Number(value)),
};
