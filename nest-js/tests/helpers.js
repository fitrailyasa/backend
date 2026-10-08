/**
 * Boots the Nest application once per test file on an in-memory SQLite database
 * and exposes the small factories the e2e suites share.
 *
 * The application is created inside `beforeAll`, which registers against whichever
 * test file required this module, so every suite gets its own isolated app and
 * database. `request`, `db` and `dataSource` are therefore exposed as live views
 * that resolve at call time instead of at require time.
 */
const supertest = require('supertest');
const { Test } = require('@nestjs/testing');
const { getDataSourceToken } = require('@nestjs/typeorm');
const { AppModule } = require('../src/app.module');
const { setupApp } = require('../src/main');
const { hashPassword } = require('../src/common/utils/password');

const PREFIX = '/api/v1';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 4;

let app;
let dataSource;
let server;
let counter = 0;

const next = () => {
  counter += 1;
  return counter;
};

const liveDataSource = () => {
  if (!dataSource) throw new Error('The test application has not started yet.');
  return dataSource;
};

const request = new Proxy(
  {},
  {
    get:
      (_target, method) =>
      (...args) => {
        if (!server) throw new Error('The test application has not started yet.');
        return supertest(server)[method](...args);
      },
  },
);

const db = new Proxy(
  {},
  {
    get:
      (_target, entity) =>
      (...args) =>
        liveDataSource().getRepository(String(entity))[args[0]](...args.slice(1)),
  },
);

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  app = moduleRef.createNestApplication();
  await setupApp(app);
  await app.init();

  dataSource = app.get(getDataSourceToken());
  server = app.getHttpServer();
});

afterAll(async () => {
  if (app) await app.close();
});

function uniqueEmail(prefix = 'user') {
  return `${prefix}${next()}@example.com`;
}

async function resetDatabase() {
  await liveDataSource().synchronize(true);
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function repository(name) {
  return liveDataSource().getRepository(name);
}

async function createUser(overrides = {}) {
  const { password = 'password', ...rest } = overrides;
  return repository('User').save({
    name: 'Test User',
    email: uniqueEmail(),
    password: await hashPassword(password, SALT_ROUNDS),
    role: 'user',
    ...rest,
  });
}

async function createAdmin(overrides = {}) {
  return createUser({ name: 'Admin', email: uniqueEmail('admin'), role: 'admin', ...overrides });
}

async function login(email, password = 'password') {
  const response = await request.post(`${PREFIX}/auth/login`).send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.token;
}

async function createCategory(overrides = {}) {
  return repository('Category').save({ name: `Category ${next()}`, ...overrides });
}

async function createTag(overrides = {}) {
  return repository('Tag').save({ name: `Tag ${next()}`, ...overrides });
}

async function createProduct(overrides = {}) {
  const { category, tags, ...rest } = overrides;
  const resolvedCategory = category ?? (await createCategory());

  const product = await repository('Product').save({
    name: `Product ${next()}`,
    price: 100,
    stock: 50,
    ...rest,
    category: resolvedCategory,
  });

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      await repository('ProductTag').save({ productId: product.id, tagId: tag.id });
    }
  }

  return product;
}

async function createComment(product, user, body = 'Nice product') {
  return repository('Comment').save({ product, user, body });
}

async function createOrderRecord({ user, status = 'pending', items }) {
  const order = await repository('Order').save({ user, status, total: 0 });

  let total = 0;
  for (const item of items) {
    const product = await repository('Product').findOneByOrFail({ id: item.product_id });
    total += Number(product.price) * item.quantity;
    await repository('OrderItem').save({
      order,
      product,
      quantity: item.quantity,
      price: product.price,
    });
  }

  order.total = Number(total.toFixed(2));
  return repository('Order').save(order);
}

module.exports = {
  PREFIX,
  get app() {
    return app;
  },
  get dataSource() {
    return dataSource;
  },
  request,
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
  repository,
  resetDatabase,
  uniqueEmail,
};
