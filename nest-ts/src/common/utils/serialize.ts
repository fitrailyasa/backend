const SENSITIVE = new Set(['password']);

const toSnakeKey = (key: string): string => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const NUMERIC_KEYS = new Set(['id', 'price', 'total', 'stock', 'quantity']);

/** MySQL returns BIGINT and DECIMAL as strings. The contract wants JSON numbers. */
const coerceNumeric = (key: string, value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  if (!(key === 'id' || key.endsWith('_id') || NUMERIC_KEYS.has(key))) return value;
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
};

/**
 * Converts entity instances / nested objects to JSON-safe snake_case, dropping the
 * password hash on every path so it can never leak into a response. Dates become
 * ISO strings and bigints become numbers so the payload is always serialisable.
 */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const plain: Record<string, unknown> =
    typeof source.toJSON === 'function'
      ? (source.toJSON() as Record<string, unknown>)
      : Object.getOwnPropertyNames(source).reduce<Record<string, unknown>>(
          (acc, key) => {
            acc[key] = source[key];
            return acc;
          },
          { ...source },
        );

  const out: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(plain)) {
    if (SENSITIVE.has(key) || key.startsWith('_') || typeof nested === 'function') continue;
    const snake = toSnakeKey(key);
    out[snake] = serialize(coerceNumeric(snake, nested));
  }

  return out;
}

export { toSnakeKey };
