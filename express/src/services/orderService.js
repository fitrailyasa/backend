import { Op } from 'sequelize';
import sequelize, { dialectName } from '../config/database.js';
import { Order, OrderItem, Product, User } from '../models/index.js';
import { ORDER_STATUSES } from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery, parseInclude } from './serviceHelpers.js';
import { toIntOrNull } from '../utils/pagination.js';

const SORTABLE = ['id', 'status', 'total', 'user_id', 'created_at', 'updated_at'];
const isMySql = dialectName === 'mysql' || dialectName === 'mariadb';

function buildIncludes(query) {
  const requested = parseInclude(query, ['items', 'items.product', 'user']);
  const include = [];

  if (requested.includes('items') || requested.includes('items.product')) {
    const items = { model: OrderItem, as: 'items', separate: true };
    if (requested.includes('items.product')) {
      items.include = [{ model: Product, as: 'product' }];
    }
    include.push(items);
  }

  if (requested.includes('user')) {
    include.push({ model: User, as: 'user' });
  }

  return include;
}

function assertOwnership(order, user) {
  if (user.role === 'admin') return order;
  if (String(order.user_id) !== String(user.id)) {
    throw ApiError.forbidden('This action is unauthorized');
  }
  return order;
}

export async function list(query, user) {
  const where = buildWhereFromQuery(query, { filters: { status: {} } });

  if (user.role === 'admin') {
    const userId = toIntOrNull(query.user_id);
    if (userId !== null) where.user_id = userId;
  } else {
    where.user_id = user.id;
  }

  return paginateQuery(Order, { query, where, include: buildIncludes(query), sortable: SORTABLE });
}

export async function getById(id, user, query = {}) {
  const order = await findByIdOrFail(Order, id, { include: buildIncludes(query), label: 'Order' });
  return assertOwnership(order, user);
}

function mergeItems(rawItems) {
  const merged = new Map();
  for (const item of rawItems) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);
    if (merged.has(productId)) {
      merged.set(productId, merged.get(productId) + quantity);
    } else {
      merged.set(productId, quantity);
    }
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ product_id: productId, quantity }));
}

export async function create(payload, user) {
  const items = mergeItems(payload.items ?? []);

  const created = await sequelize.transaction(async (transaction) => {
    const productIds = items.map((item) => item.product_id);

    const findOptions = { where: { id: { [Op.in]: productIds } }, transaction };
    if (isMySql) findOptions.lock = transaction.LOCK.UPDATE;

    const products = await Product.findAll(findOptions);
    const byId = new Map(products.map((product) => [Number(product.id), product]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw ApiError.notFound(`Product with id ${missing[0]} not found`);
    }

    for (const item of items) {
      const product = byId.get(item.product_id);
      if (product.stock < item.quantity) {
        throw ApiError.conflict(`Insufficient stock for product "${product.name}"`);
      }
    }

    const order = await Order.create({ user_id: user.id, status: 'pending', total: 0 }, { transaction });

    let total = 0;
    for (const item of items) {
      const product = byId.get(item.product_id);
      const lineTotal = Number(product.price) * item.quantity;
      total += lineTotal;

      await OrderItem.create(
        { order_id: order.id, product_id: product.id, quantity: item.quantity, price: product.price },
        { transaction },
      );

      await Product.update(
        { stock: product.stock - item.quantity },
        { where: { id: product.id }, transaction },
      );
    }

    order.total = Number(total.toFixed(2));
    await order.save({ transaction });

    return order;
  });

  return findByIdOrFail(Order, created.id, {
    include: [{ model: OrderItem, as: 'items', separate: true, include: [{ model: Product, as: 'product' }] }],
    label: 'Order',
  });
}

async function restoreStock(order, transaction, direction) {
  const items = await OrderItem.findAll({ where: { order_id: order.id }, transaction });

  for (const item of items) {
    const product = await Product.findByPk(item.product_id, {
      transaction,
      ...(isMySql ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!product) continue;

    const nextStock = direction === 'increment' ? product.stock + item.quantity : product.stock - item.quantity;
    await Product.update({ stock: Math.max(0, nextStock) }, { where: { id: product.id }, transaction });
  }
}

export async function updateStatus(id, status, user) {
  const order = await findByIdOrFail(Order, id, { label: 'Order' });
  assertOwnership(order, user);

  if (!ORDER_STATUSES.includes(status)) {
    throw ApiError.unprocessable('Validation failed', { status: [`Status must be one of: ${ORDER_STATUSES.join(', ')}.`] });
  }

  if (order.status === status) return order;

  if (user.role !== 'admin') {
    const isOwnerCancelling = order.status === 'pending' && status === 'cancelled';
    if (!isOwnerCancelling) {
      throw ApiError.forbidden('This action is unauthorized');
    }
  }

  await sequelize.transaction(async (transaction) => {
    const previous = order.status;

    if (previous !== 'cancelled' && status === 'cancelled') {
      await restoreStock(order, transaction, 'increment');
    } else if (previous === 'cancelled' && status !== 'cancelled') {
      await restoreStock(order, transaction, 'decrement');
    }

    order.status = status;
    await order.save({ transaction });
  });

  return order;
}

export async function remove(id, user) {
  const order = await findByIdOrFail(Order, id, { label: 'Order' });
  assertOwnership(order, user);

  await sequelize.transaction(async (transaction) => {
    if (order.status !== 'cancelled') {
      await restoreStock(order, transaction, 'increment');
    }
    await order.destroy({ transaction });
  });

  return true;
}

export default { list, getById, create, updateStatus, remove };
