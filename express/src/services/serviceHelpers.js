import { Op } from 'sequelize';
import ApiError from '../utils/ApiError.js';
import { parsePagination, parseOrder, parseSearch, parseInclude, buildMeta, toIntOrNull, toNumberOrNull } from '../utils/pagination.js';

export async function findByIdOrFail(Model, id, { include = [], label = 'Resource' } = {}) {
  const record = await Model.findByPk(id, { include });
  if (!record) throw ApiError.notFound(`${label} not found`);
  return record;
}

export function buildWhereFromQuery(query = {}, { searchable = [], filters = {} } = {}) {
  const where = {};
  const and = [];

  const search = parseSearch(query);
  if (search && searchable.length > 0) {
    and.push({ [Op.or]: searchable.map((field) => ({ [field]: { [Op.like]: `%${search}%` } })) });
  }

  for (const [key, spec] of Object.entries(filters)) {
    const raw = query[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (spec.type === 'int') {
      const value = toIntOrNull(raw);
      if (value !== null) where[spec.column ?? key] = value;
    } else if (spec.type === 'float') {
      const value = toNumberOrNull(raw);
      if (value !== null) where[spec.column ?? key] = value;
    } else {
      where[spec.column ?? key] = spec.transform ? spec.transform(raw) : raw;
    }
  }

  if (and.length > 0) where[Op.and] = and;

  return where;
}

export function collectInclude(query, allowed, factory) {
  const requested = parseInclude(query, allowed);
  return factory(requested);
}

export async function paginateQuery(Model, { query = {}, where = {}, include = [], distinct = false, sortable }) {
  const { page, limit, offset } = parsePagination(query);
  const order = parseOrder(query, sortable);

  const { rows, count } = await Model.findAndCountAll({ where, include, limit, offset, order, distinct });

  return { rows, meta: buildMeta(count, page, limit) };
}

export async function resolveUniqueSlug(Model, { slug, name, id = null, label = 'Slug' }) {
  const candidate = slug ?? null;
  const where = { slug: candidate };
  if (id !== null && id !== undefined) where.id = { [Op.ne]: id };

  const existing = await Model.findOne({ where, attributes: ['id'] });
  if (existing) {
    throw ApiError.conflict(`${label} "${candidate}" has already been taken`);
  }

  return candidate;
}

export { parsePagination, parseOrder, parseSearch, parseInclude, buildMeta, toIntOrNull, toNumberOrNull };
