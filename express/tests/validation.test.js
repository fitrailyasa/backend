import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { request, createAdmin, login, resetDatabase } from './helpers.js';

const PREFIX = '/api/v1';

describe('validation contract', () => {
  before(async () => {
    await resetDatabase();
  });

  it('rejects invalid register fields, list queries, and category writes', async () => {
    const invalid = await request.post(`${PREFIX}/auth/register`).send({
      name: 'A',
      email: 'bad',
      password: 'short',
      password_confirmation: 'nope',
    });
    assert.equal(invalid.status, 422);
    for (const field of ['name', 'email', 'password', 'password_confirmation']) {
      assert.ok(Array.isArray(invalid.body.errors[field]), field);
    }

    const listed = await request.get(`${PREFIX}/categories`).query({
      page: 0,
      limit: 0,
      sort: 'nope',
      order: 'sideways',
      include: 'nope',
    });
    assert.equal(listed.status, 422);
    for (const field of ['page', 'limit', 'sort', 'order', 'include']) {
      assert.ok(Array.isArray(listed.body.errors[field]), field);
    }

    const anonymous = await request.post(`${PREFIX}/categories`).send({ name: 'Valid Name' });
    assert.equal(anonymous.status, 401);

    const admin = await createAdmin({ email: 'query-admin@example.com' });
    const token = await login(admin.email);
    const rejected = await request
      .post(`${PREFIX}/categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', slug: 'Bad Slug' });
    assert.equal(rejected.status, 422);
    assert.ok(Array.isArray(rejected.body.errors.name));
    assert.ok(Array.isArray(rejected.body.errors.slug));

    const created = await request
      .post(`${PREFIX}/categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Valid Category Name' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, 'valid-category-name');
  });
});
