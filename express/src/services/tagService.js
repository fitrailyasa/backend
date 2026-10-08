import { Op } from 'sequelize';
import { Tag } from '../models/index.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery, resolveUniqueSlug } from './serviceHelpers.js';
import { slugify } from '../utils/slugify.js';

const SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at'];

export async function list(query) {
  const where = buildWhereFromQuery(query, { searchable: ['name'] });
  return paginateQuery(Tag, { query, where, sortable: SORTABLE });
}

export async function getById(id) {
  return findByIdOrFail(Tag, id, { label: 'Tag' });
}

export async function create(payload) {
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  await resolveUniqueSlug(Tag, { slug, label: 'Slug' });
  return Tag.create({ name: payload.name, slug });
}

export async function update(id, payload) {
  const tag = await findByIdOrFail(Tag, id, { label: 'Tag' });

  if (payload.name !== undefined && payload.name !== null) tag.name = payload.name;

  if (payload.slug !== undefined && payload.slug !== null) {
    const slug = slugify(payload.slug);
    await resolveUniqueSlug(Tag, { slug, id: tag.id, label: 'Slug' });
    tag.slug = slug;
  }

  await tag.save();
  return tag;
}

export async function remove(id) {
  const tag = await findByIdOrFail(Tag, id, { label: 'Tag' });
  await tag.destroy();
  return true;
}

export async function findBySlug(slug) {
  return Tag.findOne({ where: { slug: slugify(slug) } });
}

export async function findManyByIds(ids) {
  if (!ids || ids.length === 0) return [];
  return Tag.findAll({ where: { id: { [Op.in]: ids } }, order: [['id', 'ASC']] });
}

export default { list, getById, create, update, remove, findBySlug, findManyByIds };
