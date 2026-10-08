import { Op } from 'sequelize';
import { Product, Category, Tag } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery, resolveUniqueSlug, parseInclude } from './serviceHelpers.js';
import { slugify } from '../utils/slugify.js';
import { toIntOrNull, toNumberOrNull } from '../utils/pagination.js';

const SORTABLE = ['id', 'name', 'slug', 'price', 'stock', 'category_id', 'created_at', 'updated_at'];

function buildIncludes(query) {
  const requested = parseInclude(query, ['category', 'tags']);
  const include = [];

  if (requested.includes('category')) {
    include.push({ model: Category, as: 'category' });
  }

  if (requested.includes('tags')) {
    include.push({ model: Tag, as: 'tags', through: { attributes: [] } });
  }

  return include;
}

function applyTagFilters(query, include) {
  const tagId = toIntOrNull(query.tag_id);
  const tagSlug = typeof query.tag === 'string' && query.tag.trim() !== '' ? query.tag.trim() : null;

  if (tagId === null && tagSlug === null) return include;

  const where = {};
  if (tagId !== null) where.id = tagId;
  if (tagSlug !== null) where.slug = slugify(tagSlug);

  const existing = include.find((entry) => entry.as === 'tags');
  if (existing) {
    existing.where = { ...(existing.where ?? {}), ...where };
    existing.required = true;
  } else {
    include.push({
      model: Tag,
      as: 'tags',
      through: { attributes: [] },
      where,
      required: true,
    });
  }

  return include;
}

function applyPriceFilters(query, where) {
  const min = toNumberOrNull(query.min_price);
  const max = toNumberOrNull(query.max_price);

  if (min !== null || max !== null) {
    const range = {};
    if (min !== null) range[Op.gte] = min;
    if (max !== null) range[Op.lte] = max;
    where.price = range;
  }

  return where;
}

export async function list(query) {
  const where = buildWhereFromQuery(query, {
    searchable: ['name', 'description'],
    filters: { category_id: { type: 'int' } },
  });
  applyPriceFilters(query, where);

  const include = applyTagFilters(query, buildIncludes(query));
  const needsDistinct = include.some((entry) => entry.as === 'tags' && entry.required);

  return paginateQuery(Product, { query, where, include, distinct: needsDistinct, sortable: SORTABLE });
}

export async function getById(id, query = {}) {
  const include = applyTagFilters(query, buildIncludes(query));
  return findByIdOrFail(Product, id, { include, label: 'Product' });
}

async function assertCategoryExists(categoryId) {
  if (categoryId === undefined || categoryId === null) return null;
  const category = await Category.findByPk(categoryId, { attributes: ['id'] });
  if (!category) {
    throw ApiError.unprocessable('Validation failed', { category_id: ['The selected category id is invalid.'] });
  }
  return category;
}

async function resolveTagIds(tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return null;
  const unique = [...new Set(tagIds.map((value) => Number(value)))];
  const found = await Tag.findAll({ where: { id: { [Op.in]: unique } }, attributes: ['id'] });
  if (found.length !== unique.length) {
    throw ApiError.unprocessable('Validation failed', { tags: ['One or more selected tags are invalid.'] });
  }
  return found.map((tag) => tag.id);
}

export async function create(payload) {
  await assertCategoryExists(payload.category_id);

  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  await resolveUniqueSlug(Product, { slug, label: 'Slug' });

  const product = await Product.create({
    category_id: payload.category_id,
    name: payload.name,
    slug,
    description: payload.description ?? null,
    price: payload.price,
    stock: payload.stock ?? 0,
  });

  const tagIds = await resolveTagIds(payload.tags);
  if (tagIds) await product.setTags(tagIds);

  return product;
}

export async function update(id, payload) {
  const product = await findByIdOrFail(Product, id, { label: 'Product' });

  if (payload.category_id !== undefined && payload.category_id !== null) {
    await assertCategoryExists(payload.category_id);
    product.category_id = payload.category_id;
  }

  if (payload.name !== undefined && payload.name !== null) product.name = payload.name;

  if (payload.slug !== undefined && payload.slug !== null) {
    const slug = slugify(payload.slug);
    await resolveUniqueSlug(Product, { slug, id: product.id, label: 'Slug' });
    product.slug = slug;
  }

  if (payload.description !== undefined) product.description = payload.description;
  if (payload.price !== undefined && payload.price !== null) product.price = payload.price;
  if (payload.stock !== undefined && payload.stock !== null) product.stock = payload.stock;

  await product.save();

  if (payload.tags !== undefined) {
    const tagIds = await resolveTagIds(payload.tags);
    await product.setTags(tagIds ?? []);
  }

  return product;
}

export async function remove(id) {
  const product = await findByIdOrFail(Product, id, { label: 'Product' });
  await product.destroy();
  return true;
}

export default { list, getById, create, update, remove };
