import env from '../config/env.js';

export const DEFAULT_SORT = 'id';
export const DEFAULT_ORDER = 'desc';

export function parsePagination(query = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const requested = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : env.pagination.limit;
  const limit = Math.min(requested, env.pagination.maxLimit);

  return { page, limit, offset: (page - 1) * limit };
}

export function parseOrder(query = {}, sortable = [DEFAULT_SORT]) {
  const rawSort = typeof query.sort === 'string' ? query.sort.trim() : '';
  const rawOrder = typeof query.order === 'string' ? query.order.trim().toLowerCase() : '';

  const field = sortable.includes(rawSort) ? rawSort : (sortable.includes(DEFAULT_SORT) ? DEFAULT_SORT : sortable[0]);
  const direction = rawOrder === 'asc' ? 'ASC' : 'DESC';

  return [[field, direction]];
}

export function parseSearch(query = {}) {
  const raw = typeof query.search === 'string' ? query.search.trim() : '';
  return raw.length > 0 ? raw : null;
}

export function parseInclude(query = {}, allowed = []) {
  const raw = typeof query.include === 'string' ? query.include : '';
  if (raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => allowed.includes(entry));
}

export function buildMeta(count, page, limit) {
  const total = Number(count) || 0;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { page, limit, total, total_pages: totalPages };
}

export function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default { parsePagination, parseOrder, parseSearch, parseInclude, buildMeta };
