const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const COLUMN_TO_PROPERTY = {
  id: 'id',
  name: 'name',
  email: 'email',
  role: 'role',
  slug: 'slug',
  price: 'price',
  stock: 'stock',
  status: 'status',
  total: 'total',
  body: 'body',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
};

/**
 * Maps a client-facing sort key (`created_at`) onto the TypeORM property (`createdAt`).
 * Unknown keys fall back to `fallback`, so a client can never inject a column name.
 */
const resolveSortColumn = (sort, sortable, fallback = 'id') => {
  const requested = sort && sortable.includes(sort) ? sort : fallback;
  return COLUMN_TO_PROPERTY[requested] || requested;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

/**
 * Normalises `?page&limit&search&sort&order` into a shape the services hand to TypeORM.
 */
const buildPagination = (query = {}, defaults = {}) => {
  const defaultLimit = toPositiveInt(defaults.defaultLimit, DEFAULT_LIMIT);
  const maxLimit = toPositiveInt(defaults.maxLimit, MAX_LIMIT);

  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(maxLimit, toPositiveInt(query.limit, defaultLimit));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    search: query.search ? String(query.search).trim() : undefined,
    sort: query.sort ? String(query.sort).trim() : undefined,
    order: String(query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC',
  };
};

/** Escapes the characters that are special inside a MySQL LIKE pattern. */
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (match) => `\\${match}`);

/** `%term%` used by every `?search=` implementation. */
const searchPattern = (value) => `%${escapeLike(String(value).trim())}%`;

/**
 * Splits an `?include=` value into a normalised list, ignoring unsupported relations.
 */
const parseIncludes = (include, allowed) => {
  if (!include) return [];
  const requested = String(include)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return requested.filter((value) => allowed.includes(value));
};

module.exports = {
  buildPagination,
  escapeLike,
  parseIncludes,
  resolveSortColumn,
  searchPattern,
  COLUMN_TO_PROPERTY,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
