import { Category, Product } from '../models/index.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery, resolveUniqueSlug, parseInclude } from './serviceHelpers.js';
import { slugify } from '../utils/slugify.js';

const SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at'];

function includesFor(query) {
  return parseInclude(query, ['products']).includes('products')
    ? [{ model: Product, as: 'products', separate: true }]
    : [];
}

export async function list(query) {
  const where = buildWhereFromQuery(query, { searchable: ['name', 'description'] });
  return paginateQuery(Category, { query, where, include: includesFor(query), sortable: SORTABLE });
}

export async function getById(id, query = {}) {
  return findByIdOrFail(Category, id, { include: includesFor(query), label: 'Category' });
}

export async function create(payload) {
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  await resolveUniqueSlug(Category, { slug, label: 'Slug' });
  return Category.create({ name: payload.name, slug, description: payload.description ?? null });
}

export async function update(id, payload) {
  const category = await findByIdOrFail(Category, id, { label: 'Category' });

  if (payload.name !== undefined && payload.name !== null) category.name = payload.name;

  if (payload.slug !== undefined && payload.slug !== null) {
    const slug = slugify(payload.slug);
    await resolveUniqueSlug(Category, { slug, id: category.id, label: 'Slug' });
    category.slug = slug;
  }

  if (payload.description !== undefined) category.description = payload.description;

  await category.save();
  return category;
}

export async function remove(id) {
  const category = await findByIdOrFail(Category, id, { label: 'Category' });
  await category.destroy();
  return true;
}

export default { list, getById, create, update, remove };
