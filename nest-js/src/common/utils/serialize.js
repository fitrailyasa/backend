const SENSITIVE = new Set(['password']);

const toSnakeKey = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const NUMERIC_KEYS = new Set(['id', 'price', 'total', 'stock', 'quantity']);

/** MySQL returns BIGINT and DECIMAL as strings. The contract wants JSON numbers. */
const coerceNumeric = (key, value) => {
  if (typeof value !== 'string') return value;
  if (!(key === 'id' || key.endsWith('_id') || NUMERIC_KEYS.has(key))) return value;
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
};

/**
 * Converts entity instances / nested objects to JSON-safe snake_case, dropping
 * the password hash on every path so it can never leak into a response.
 */
const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value !== 'object') return value;

  const plain =
    typeof value.toJSON === 'function'
      ? value.toJSON()
      : Object.getOwnPropertyNames(value).reduce((acc, key) => {
          acc[key] = value[key];
          return acc;
        }, { ...value });

  const out = {};

  for (const [key, nested] of Object.entries(plain)) {
    if (SENSITIVE.has(key) || key.startsWith('_') || typeof nested === 'function') continue;
    const keyName = toSnakeKey(key);
    out[keyName] = serialize(coerceNumeric(keyName, nested));
  }

  return out;
};

module.exports = { serialize, toSnakeKey };
