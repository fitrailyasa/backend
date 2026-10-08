/**
 * Hits every HTTP route once. nest-js/tests/api.e2e.test.js mirrors this file.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/common/utils/password';
import { setupApp } from '../src/main';
import { User, UserRole } from '../src/users/entities/user.entity';

const PREFIX = '/api/v1';
const password = 'password';

let app: INestApplication;
let dataSource: DataSource;
let sequence = 0;

const nextEmail = (prefix = 'user') => {
  sequence += 1;
  return `${prefix}${sequence}@example.com`;
};

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const registerBody = (email: string, name = 'User One') => ({
  name,
  email,
  password,
  password_confirmation: password,
});

const http = () => request(app.getHttpServer());

async function createUser(overrides: Partial<User> & { email?: string; name?: string } = {}) {
  const repository = dataSource.getRepository(User);
  return repository.save(
    repository.create({
      name: overrides.name ?? 'Test User',
      email: overrides.email ?? nextEmail(),
      password: await hashPassword(password),
      role: overrides.role ?? UserRole.USER,
    }),
  );
}

async function createAdmin() {
  return createUser({ name: 'Admin', email: nextEmail('admin'), role: UserRole.ADMIN });
}

async function login(email: string) {
  const response = await http().post(`${PREFIX}/auth/login`).send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data.token as string;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await setupApp(app);
  await app.init();
  dataSource = app.get(getDataSourceToken());
});

afterAll(async () => {
  await app.close();
});

describe('HTTP API', () => {
  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  it('GET /health is a raw probe and GET /api/v1 lists the routes', async () => {
    const health = await http().get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual(
      expect.objectContaining({ status: 'ok', timestamp: expect.any(String) }),
    );
    expect(health.body.success).toBeUndefined();

    const index = await http().get(PREFIX);
    expect(index.status).toBe(200);
    expect(index.body.success).toBe(true);
    expect(index.body.message).toBe('API index retrieved');
    expect(index.body.data.prefix).toBe('/api/v1');
    expect(index.body.data.endpoints.length).toBeGreaterThan(10);
  });

  it('covers register, login, refresh, logout and the profile routes', async () => {
    const email = 'ada@example.com';
    const registered = await http().post(`${PREFIX}/auth/register`).send(registerBody(email));

    expect(registered.status).toBe(201);
    expect(registered.body.success).toBe(true);
    expect(registered.body.data.token).toEqual(expect.any(String));
    expect(registered.body.data.refresh_token).toEqual(expect.any(String));
    expect(registered.body.data.token_type).toBe('Bearer');
    expect(Object.keys(registered.body.data)).toEqual(['user', 'token', 'refresh_token', 'token_type', 'expires_in']);
    expect(registered.body.data.user.email).toBe(email);
    expect(registered.body.data.user.password).toBeUndefined();

    const duplicate = await http().post(`${PREFIX}/auth/register`).send(registerBody(email));
    expect(duplicate.status).toBe(422);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.errors.email).toEqual(expect.any(Array));

    const invalid = await http().post(`${PREFIX}/auth/register`).send({ email: 'not-an-email' });
    expect(invalid.status).toBe(422);

    const loginResponse = await http().post(`${PREFIX}/auth/login`).send({ email, password });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.token).toEqual(expect.any(String));

    const rejected = await http().post(`${PREFIX}/auth/login`).send({ email, password: 'wrong-password' });
    expect(rejected.status).toBe(401);
    expect(rejected.body.success).toBe(false);

    const token = loginResponse.body.data.token as string;
    const headers = bearer(token);

    const me = await http().get(`${PREFIX}/auth/me`).set(headers);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const profile = await http().get(`${PREFIX}/users/me`).set(headers);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);
    expect(profile.body.data.password).toBeUndefined();

    const anonymous = await http().get(`${PREFIX}/auth/me`);
    expect(anonymous.status).toBe(401);

    const refreshed = await http()
      .post(`${PREFIX}/auth/refresh`)
      .set(bearer(loginResponse.body.data.refresh_token));
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.token).toEqual(expect.any(String));
    expect(refreshed.body.data.token).not.toBe(token);

    const loggedOut = await http().post(`${PREFIX}/auth/logout`).set(headers);
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.body.success).toBe(true);

    const afterLogout = await http().get(`${PREFIX}/auth/me`).set(headers);
    expect(afterLogout.status).toBe(401);
  });

  it('lets an admin manage users and rejects everyone else', async () => {
    const adminHeaders = bearer(await login((await createAdmin()).email));
    const memberHeaders = bearer(await login((await createUser({ email: 'member@example.com', name: 'Member' })).email));

    const forbidden = await http().get(`${PREFIX}/users`).set(memberHeaders);
    expect(forbidden.status).toBe(403);

    const created = await http().post(`${PREFIX}/users`).set(adminHeaders).send({
      name: 'Extra User',
      email: 'extra@example.com',
      password,
      role: 'user',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.email).toBe('extra@example.com');
    expect(created.body.data.password).toBeUndefined();
    const userId = created.body.data.id;

    const list = await http().get(`${PREFIX}/users`).set(adminHeaders);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(list.body.data.some((user: { email: string }) => user.email === 'extra@example.com')).toBe(true);

    const one = await http().get(`${PREFIX}/users/${userId}`).set(adminHeaders);
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe(userId);

    const replaced = await http().put(`${PREFIX}/users/${userId}`).set(adminHeaders).send({
      name: 'Extra Updated',
      email: 'extra@example.com',
      password,
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.name).toBe('Extra Updated');

    const patched = await http().patch(`${PREFIX}/users/${userId}`).set(adminHeaders).send({ name: 'Extra Patched' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe('Extra Patched');

    const missing = await http().get(`${PREFIX}/users/99999`).set(adminHeaders);
    expect(missing.status).toBe(404);

    const removed = await http().delete(`${PREFIX}/users/${userId}`).set(adminHeaders);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ success: true, message: 'User deleted successfully', data: null });

    const gone = await http().get(`${PREFIX}/users/${userId}`).set(adminHeaders);
    expect(gone.status).toBe(404);
  });

  it('covers category, tag and product routes', async () => {
    const adminHeaders = bearer(await login((await createAdmin()).email));
    const memberHeaders = bearer(await login((await createUser()).email));

    const denied = await http().post(`${PREFIX}/categories`).set(memberHeaders).send({ name: 'Blocked' });
    expect(denied.status).toBe(403);

    const category = await http().post(`${PREFIX}/categories`).set(adminHeaders).send({
      name: 'Electronics',
      description: 'Devices',
    });
    expect(category.status).toBe(201);
    expect(category.body.data.slug).toBe('electronics');
    const categoryId = category.body.data.id;

    const second = await http().post(`${PREFIX}/categories`).set(adminHeaders).send({ name: 'Electronics' });
    expect(second.status).toBe(201);
    expect(second.body.data.slug).not.toBe('electronics');

    const categories = await http().get(`${PREFIX}/categories`);
    expect(categories.status).toBe(200);
    expect(categories.body.meta.page).toBe(1);
    expect(categories.body.data.length).toBeGreaterThanOrEqual(2);

    const categoryOne = await http().get(`${PREFIX}/categories/${categoryId}`);
    expect(categoryOne.status).toBe(200);
    expect(categoryOne.body.data.name).toBe('Electronics');

    const replacedCategory = await http()
      .put(`${PREFIX}/categories/${categoryId}`)
      .set(adminHeaders)
      .send({ name: 'Gadgets', description: 'Updated' });
    expect(replacedCategory.status).toBe(200);
    expect(replacedCategory.body.data.name).toBe('Gadgets');

    const patchedCategory = await http()
      .patch(`${PREFIX}/categories/${second.body.data.id}`)
      .set(adminHeaders)
      .send({ description: 'Second shelf' });
    expect(patchedCategory.status).toBe(200);
    expect(patchedCategory.body.data.description).toBe('Second shelf');

    const tag = await http().post(`${PREFIX}/tags`).set(adminHeaders).send({ name: 'Sale' });
    expect(tag.status).toBe(201);
    const tagId = tag.body.data.id;

    const spareTag = await http().post(`${PREFIX}/tags`).set(adminHeaders).send({ name: 'Clearance' });
    expect(spareTag.status).toBe(201);

    const tags = await http().get(`${PREFIX}/tags`);
    expect(tags.status).toBe(200);
    expect(tags.body.data.length).toBe(2);

    const tagOne = await http().get(`${PREFIX}/tags/${tagId}`);
    expect(tagOne.status).toBe(200);

    const replacedTag = await http().put(`${PREFIX}/tags/${tagId}`).set(adminHeaders).send({ name: 'Promo' });
    expect(replacedTag.status).toBe(200);
    expect(replacedTag.body.data.name).toBe('Promo');

    const patchedTag = await http()
      .patch(`${PREFIX}/tags/${spareTag.body.data.id}`)
      .set(adminHeaders)
      .send({ name: 'Outlet' });
    expect(patchedTag.status).toBe(200);

    const product = await http().post(`${PREFIX}/products`).set(adminHeaders).send({
      name: 'Keyboard',
      category_id: categoryId,
      price: 100,
      stock: 10,
      tag_ids: [tagId],
    });
    expect(product.status).toBe(201);
    expect(product.body.data.slug).toBe('keyboard');
    expect(Number(product.body.data.price)).toBe(100);
    const productId = product.body.data.id;

    const products = await http().get(`${PREFIX}/products`);
    expect(products.status).toBe(200);
    expect(products.body.meta.total).toBe(1);

    const productOne = await http().get(`${PREFIX}/products/${productId}`);
    expect(productOne.status).toBe(200);
    expect(productOne.body.data.name).toBe('Keyboard');

    const replacedProduct = await http().put(`${PREFIX}/products/${productId}`).set(adminHeaders).send({
      name: 'Mechanical Keyboard',
      category_id: categoryId,
      price: 120,
      stock: 10,
      tag_ids: [tagId],
    });
    expect(replacedProduct.status).toBe(200);
    expect(Number(replacedProduct.body.data.price)).toBe(120);

    const patchedProduct = await http()
      .patch(`${PREFIX}/products/${productId}`)
      .set(adminHeaders)
      .send({ stock: 8 });
    expect(patchedProduct.status).toBe(200);
    expect(patchedProduct.body.data.stock).toBe(8);

    const removedTag = await http().delete(`${PREFIX}/tags/${spareTag.body.data.id}`).set(adminHeaders);
    expect(removedTag.status).toBe(200);

    const removedCategory = await http().delete(`${PREFIX}/categories/${second.body.data.id}`).set(adminHeaders);
    expect(removedCategory.status).toBe(200);

    const removedProduct = await http().delete(`${PREFIX}/products/${productId}`).set(adminHeaders);
    expect(removedProduct.status).toBe(200);

    const missingProduct = await http().get(`${PREFIX}/products/${productId}`);
    expect(missingProduct.status).toBe(404);
  });

  it('creates an order from product prices and enforces stock and ownership', async () => {
    const buyerHeaders = bearer(await login((await createUser({ email: 'buyer@example.com', name: 'Buyer' })).email));
    const strangerHeaders = bearer(await login((await createUser({ email: 'other@example.com' })).email));
    const adminHeaders = bearer(await login((await createAdmin()).email));

    const category = await http().post(`${PREFIX}/categories`).set(adminHeaders).send({ name: 'Books' });
    const product = await http().post(`${PREFIX}/products`).set(adminHeaders).send({
      name: 'Notebook',
      category_id: category.body.data.id,
      price: 100,
      stock: 10,
    });
    const productId = product.body.data.id;

    const created = await http().post(`${PREFIX}/orders`).set(buyerHeaders).send({
      items: [
        { product_id: productId, quantity: 1 },
        { product_id: productId, quantity: 1 },
      ],
    });
    expect(created.status).toBe(201);
    expect(Number(created.body.data.total)).toBe(200);
    const orderId = created.body.data.id;

    const stock = await http().get(`${PREFIX}/products/${productId}`);
    expect(stock.body.data.stock).toBe(8);

    const detail = await http().get(`${PREFIX}/orders/${orderId}?include=items`).set(buyerHeaders);
    expect(detail.status).toBe(200);
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.items[0].quantity).toBe(2);

    const mine = await http().get(`${PREFIX}/orders`).set(buyerHeaders);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);

    const hidden = await http().get(`${PREFIX}/orders/${orderId}`).set(strangerHeaders);
    expect(hidden.status).toBe(403);

    const all = await http().get(`${PREFIX}/orders`).set(adminHeaders);
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(1);

    const paid = await http().patch(`${PREFIX}/orders/${orderId}/status`).set(buyerHeaders).send({ status: 'paid' });
    expect(paid.status).toBe(403);

    const cancelled = await http()
      .patch(`${PREFIX}/orders/${orderId}/status`)
      .set(buyerHeaders)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');

    const shortage = await http()
      .post(`${PREFIX}/orders`)
      .set(buyerHeaders)
      .send({ items: [{ product_id: productId, quantity: 100 }] });
    expect(shortage.status).toBe(422);
    expect(shortage.body.errors.items).toEqual(expect.any(Array));

    const unknown = await http()
      .post(`${PREFIX}/orders`)
      .set(buyerHeaders)
      .send({ items: [{ product_id: 99999, quantity: 1 }] });
    expect(unknown.status).toBe(404);

    const denied = await http().delete(`${PREFIX}/orders/${orderId}`).set(buyerHeaders);
    expect(denied.status).toBe(403);

    const removed = await http().delete(`${PREFIX}/orders/${orderId}`).set(adminHeaders);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);
  });

  it('covers product comments and the comment collection', async () => {
    const authorHeaders = bearer(
      await login((await createUser({ email: 'author@example.com', name: 'Author' })).email),
    );
    const adminHeaders = bearer(await login((await createAdmin()).email));
    const category = await http().post(`${PREFIX}/categories`).set(adminHeaders).send({ name: 'Audio' });
    const product = await http().post(`${PREFIX}/products`).set(adminHeaders).send({
      name: 'Speaker',
      category_id: category.body.data.id,
      price: 50,
      stock: 4,
    });
    const productId = product.body.data.id;

    const created = await http()
      .post(`${PREFIX}/products/${productId}/comments`)
      .set(authorHeaders)
      .send({ body: 'Sounds great' });
    expect(created.status).toBe(201);
    expect(created.body.data.body).toBe('Sounds great');
    const commentId = created.body.data.id;

    const onProduct = await http().get(`${PREFIX}/products/${productId}/comments`);
    expect(onProduct.status).toBe(200);
    expect(onProduct.body.data).toHaveLength(1);

    const all = await http().get(`${PREFIX}/comments`);
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(1);

    const patched = await http()
      .patch(`${PREFIX}/comments/${commentId}`)
      .set(authorHeaders)
      .send({ body: 'Sounds even better' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.body).toBe('Sounds even better');

    const removed = await http().delete(`${PREFIX}/comments/${commentId}`).set(authorHeaders);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);

    const empty = await http().get(`${PREFIX}/comments`);
    expect(empty.body.meta.total).toBe(0);
  });
});
