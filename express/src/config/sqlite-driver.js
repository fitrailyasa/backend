import { DatabaseSync } from 'node:sqlite';

export const OPEN_READONLY = 0x00000001;
export const OPEN_READWRITE = 0x00000002;
export const OPEN_CREATE = 0x00000004;
export const OPEN_FULLMUTEX = 0x00010000;

function toPlainRow(row) {
  if (row === null || row === undefined) return row;
  return Object.assign({}, row);
}

const BASE_CODES = {
  1: 'SQLITE_ERROR',
  2: 'SQLITE_INTERNAL',
  3: 'SQLITE_PERM',
  4: 'SQLITE_ABORT',
  5: 'SQLITE_BUSY',
  6: 'SQLITE_LOCKED',
  7: 'SQLITE_NOMEM',
  8: 'SQLITE_READONLY',
  9: 'SQLITE_INTERRUPT',
  10: 'SQLITE_IOERR',
  11: 'SQLITE_CORRUPT',
  12: 'SQLITE_NOTFOUND',
  13: 'SQLITE_FULL',
  14: 'SQLITE_CANTOPEN',
  15: 'SQLITE_PROTOCOL',
  16: 'SQLITE_EMPTY',
  17: 'SQLITE_SCHEMA',
  18: 'SQLITE_TOOBIG',
  19: 'SQLITE_CONSTRAINT',
  20: 'SQLITE_MISMATCH',
  21: 'SQLITE_MISUSE',
  22: 'SQLITE_NOLFS',
  23: 'SQLITE_AUTH',
  24: 'SQLITE_FORMAT',
  25: 'SQLITE_RANGE',
  26: 'SQLITE_NOTADB',
};

const CONSTRAINT_CODES = {
  1: 'SQLITE_CONSTRAINT_CHECK',
  2: 'SQLITE_CONSTRAINT_COMMITHOOK',
  3: 'SQLITE_CONSTRAINT_FOREIGNKEY',
  4: 'SQLITE_CONSTRAINT_FUNCTION',
  5: 'SQLITE_CONSTRAINT_NOTNULL',
  6: 'SQLITE_CONSTRAINT_PRIMARYKEY',
  7: 'SQLITE_CONSTRAINT_TRIGGER',
  8: 'SQLITE_CONSTRAINT_UNIQUE',
  9: 'SQLITE_CONSTRAINT_VTAB',
  10: 'SQLITE_CONSTRAINT_ROWID',
  11: 'SQLITE_CONSTRAINT_PINNED',
  12: 'SQLITE_CONSTRAINT_DATATYPE',
};

/**
 * node:sqlite reports `code: 'ERR_SQLITE_ERROR'` plus a numeric `errcode`,
 * while the `sqlite3` driver that Sequelize's sqlite dialect expects reports
 * symbolic codes such as `SQLITE_CONSTRAINT_FOREIGNKEY`. Translate between the
 * two so Sequelize maps driver failures onto its own error classes.
 */
function normalizeError(error, sql) {
  if (error === null || typeof error !== 'object') return error;

  const errcode = Number(error.errcode);
  if (!Number.isInteger(errcode) || errcode <= 0) return error;

  const base = errcode & 0xff;
  const extended = errcode >>> 8;

  error.code = base === 19 ? CONSTRAINT_CODES[extended] ?? 'SQLITE_CONSTRAINT' : BASE_CODES[base] ?? 'SQLITE_ERROR';
  if (sql !== undefined) error.sql = sql;

  return error;
}


function splitArgs(args) {
  const rest = Array.prototype.slice.call(args);
  let callback = null;
  if (rest.length > 0 && typeof rest[rest.length - 1] === 'function') {
    callback = rest.pop();
  }
  return { params: rest.length > 0 ? rest[0] : undefined, callback };
}

function bindArgs(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object') return [params];
  return [params];
}

class Database {
  constructor(filename, mode, callback) {
    let done = callback;
    let storage = filename;
    let flags = mode;
    if (typeof storage === 'function') {
      done = storage;
      storage = ':memory:';
      flags = undefined;
    }
    if (Buffer.isBuffer(storage)) storage = storage.toString('utf8');
    if (storage === undefined || storage === null || storage === '') storage = ':memory:';

    this.filename = storage;
    this.mode = typeof flags === 'number' ? flags : OPEN_READWRITE | OPEN_CREATE;
    this.uuid = storage;
    this.open = true;
    this._listeners = new Map();
    this._cache = new Map();

    this._db = new DatabaseSync(storage, { enableForeignKeyConstraints: true });

    if (typeof done === 'function') {
      setImmediate(() => done.call(this));
    }
  }

  _statement(sql) {
    let statement = this._cache.get(sql);
    if (statement === undefined) {
      statement = this._db.prepare(sql);
      this._cache.set(sql, statement);
    }
    return statement;
  }

  run(sql, ...args) {
    const { params, callback } = splitArgs(args);
    const meta = { lastID: undefined, changes: 0 };
    try {
      const result = this._statement(sql).run(...bindArgs(params));
      meta.changes = Number(result.changes ?? 0);
      meta.lastID = result.lastInsertRowid === undefined ? undefined : Number(result.lastInsertRowid);
    } catch (error) {
      normalizeError(error, sql);
      if (typeof callback === 'function') return void setImmediate(() => callback.call(meta, error));
      throw error;
    }
    if (typeof callback === 'function') return void setImmediate(() => callback.call(meta, null));
    return undefined;
  }

  all(sql, ...args) {
    const { params, callback } = splitArgs(args);
    let rows;
    try {
      rows = this._statement(sql).all(...bindArgs(params)).map(toPlainRow);
    } catch (error) {
      normalizeError(error, sql);
      if (typeof callback === 'function') return void setImmediate(() => callback.call(this, error));
      throw error;
    }
    if (typeof callback === 'function') return void setImmediate(() => callback.call(this, null, rows));
    return rows;
  }

  get(sql, ...args) {
    const { params, callback } = splitArgs(args);
    let row;
    try {
      row = toPlainRow(this._statement(sql).get(...bindArgs(params)));
    } catch (error) {
      normalizeError(error, sql);
      if (typeof callback === 'function') return void setImmediate(() => callback.call(this, error));
      throw error;
    }
    if (typeof callback === 'function') return void setImmediate(() => callback.call(this, null, row));
    return row;
  }

  each(sql, ...args) {
    const { params } = splitArgs(args);
    const callbacks = Array.prototype.slice.call(args).filter((entry) => typeof entry === 'function');
    const [rowCallback, doneCallback] = callbacks;
    const rows = this.all(sql, params);
    for (const row of rows) {
      if (typeof rowCallback === 'function' && rowCallback.call(this, null, row) === false) break;
    }
    if (typeof doneCallback === 'function') setImmediate(() => doneCallback.call(this, null, rows.length));
    return undefined;
  }

  exec(sql, callback) {
    try {
      this._db.exec(sql);
    } catch (error) {
      normalizeError(error, sql);
      if (typeof callback === 'function') return void setImmediate(() => callback.call(this, error));
      throw error;
    }
    if (typeof callback === 'function') return void setImmediate(() => callback.call(this, null));
    return undefined;
  }

  serialize(fn) {
    if (typeof fn === 'function') return fn();
    return this;
  }

  parallelize(fn) {
    if (typeof fn === 'function') return fn();
    return this;
  }

  configure() {
    return this;
  }

  on(event, listener) {
    if (typeof listener !== 'function') return this;
    const bucket = this._listeners.get(event) ?? [];
    bucket.push(listener);
    this._listeners.set(event, bucket);
    return this;
  }

  once(event, listener) {
    return this.on(event, listener);
  }

  removeListener(event, listener) {
    const bucket = this._listeners.get(event);
    if (bucket) this._listeners.set(event, bucket.filter((entry) => entry !== listener));
    return this;
  }

  close(callback) {
    if (this.open) {
      this.open = false;
      this._cache.clear();
      this._db.close();
    }
    if (typeof callback === 'function') setImmediate(() => callback.call(this, null));
    return undefined;
  }
}

const sqliteModule = {
  OPEN_READONLY,
  OPEN_READWRITE,
  OPEN_CREATE,
  OPEN_FULLMUTEX,
  Database,
  verbose() {
    return sqliteModule;
  },
};

export default sqliteModule;
