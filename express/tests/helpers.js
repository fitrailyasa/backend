import supertest from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.DB_SYNC = 'true';
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-1234567890';
process.env.BCRYPT_ROUNDS = '4';
process.env.LOG_FORMAT = 'tiny';
process.env.RATE_LIMIT_MAX = '100000';

const [{ createApp }, { sequelize, syncDatabase }, models, { default: env }] = await Promise.all([
  import('../src/app.js'),
  import('../src/config/database.js'),
  import('../src/models/index.js'),
  import('../src/config/env.js'),
]);

const { User, Category, Product, Tag, Comment, Order, OrderItem } = models;

await syncDatabase({ force: true });

export const app = createApp();
export const request = supertest(app);
export const db = models;
export const api = request;

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

export function uniqueEmail(prefix = 'user') {
  return `${prefix}${next()}@example.com`;
}

export async function resetDatabase() {
  await syncDatabase({ force: true });
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function createUser(overrides = {}) {
  const { password = 'password', ...rest } = overrides;
  return User.create({
    name: 'Test User',
    email: uniqueEmail(),
    password,
    role: 'user',
    ...rest,
  });
}

export async function createAdmin(overrides = {}) {
  return createUser({ name: 'Admin', email: uniqueEmail('admin'), role: 'admin', ...overrides });
}

export async function login(email, password = 'password') {
  const response = await request.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.token;
}

export async function createCategory(overrides = {}) {
  return Category.create({ name: `Category ${next()}`, ...overrides });
}

export async function createTag(overrides = {}) {
  return Tag.create({ name: `Tag ${next()}`, ...overrides });
}

export async function createProduct(overrides = {}) {
  const { category, tags, category_id, ...rest } = overrides;
  const resolvedCategory = category ?? (category_id ? null : await createCategory());

  const product = await Product.create({
    name: `Product ${next()}`,
    price: 100,
    stock: 50,
    ...rest,
    category_id: category_id ?? resolvedCategory.id,
  });

  if (Array.isArray(tags) && tags.length > 0) {
    await product.setTags(tags);
  }

  return product;
}

export async function createComment(product, user, body = 'Nice product') {
  return Comment.create({ product_id: product.id, user_id: user.id, body });
}

export async function createOrderRecord({ user, status = 'pending', items }) {
  const order = await Order.create({ user_id: user.id, status, total: 0 });

  let total = 0;
  for (const item of items) {
    const product = await Product.findByPk(item.product_id);
    total += Number(product.price) * item.quantity;
    await OrderItem.create({
      order_id: order.id,
      product_id: product.id,
      quantity: item.quantity,
      price: product.price,
    });
  }

  order.total = Number(total.toFixed(2));
  await order.save();
  return order;
}

export { sequelize, syncDatabase, env };

export default {
  app,
  api,
  db,
  bearer,
  createAdmin,
  createCategory,
  createComment,
  createOrderRecord,
  createProduct,
  createTag,
  createUser,
  login,
  request,
  resetDatabase,
  uniqueEmail,
};
