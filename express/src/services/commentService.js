import { Comment, Product, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery, parseInclude } from './serviceHelpers.js';
import { toIntOrNull } from '../utils/pagination.js';

const SORTABLE = ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at'];

async function assertProductExists(productId) {
  const product = await Product.findByPk(productId, { attributes: ['id'] });
  if (!product) throw ApiError.notFound(`Product with id ${productId} not found`);
  return product;
}

function buildIncludes(query) {
  const requested = parseInclude(query, ['user', 'product']);
  const include = [];
  if (requested.includes('user')) include.push({ model: User, as: 'user' });
  if (requested.includes('product')) include.push({ model: Product, as: 'product' });
  return include;
}

export async function list(query) {
  const where = buildWhereFromQuery(query, {
    searchable: ['body'],
    filters: { product_id: { type: 'int' }, user_id: { type: 'int' } },
  });

  return paginateQuery(Comment, { query, where, include: buildIncludes(query), sortable: SORTABLE });
}

export async function listByProduct(productId, query) {
  await assertProductExists(productId);

  const where = buildWhereFromQuery(query, {
    searchable: ['body'],
    filters: { product_id: { type: 'int' }, user_id: { type: 'int' } },
  });
  where.product_id = productId;

  return paginateQuery(Comment, { query, where, include: buildIncludes(query), sortable: SORTABLE });
}

export async function getById(id, query = {}) {
  return findByIdOrFail(Comment, id, { include: buildIncludes(query), label: 'Comment' });
}

function assertOwnership(comment, user) {
  if (user.role === 'admin') return comment;
  if (String(comment.user_id) !== String(user.id)) {
    throw ApiError.forbidden('This action is unauthorized');
  }
  return comment;
}

export async function create(productId, payload, user) {
  await assertProductExists(productId);

  const comment = await Comment.create({
    product_id: productId,
    user_id: user.id,
    body: payload.body,
  });

  return comment;
}

export async function update(id, payload, user) {
  const comment = await findByIdOrFail(Comment, id, { label: 'Comment' });
  assertOwnership(comment, user);

  if (payload.body !== undefined && payload.body !== null) comment.body = payload.body;

  await comment.save();
  return comment;
}

export async function remove(id, user) {
  const comment = await findByIdOrFail(Comment, id, { label: 'Comment' });
  assertOwnership(comment, user);
  await comment.destroy();
  return true;
}

export { toIntOrNull };
export default { list, listByProduct, getById, create, update, remove };
