import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  request,
  createAdmin,
  createUser,
  login,
  resetDatabase,
  uniqueEmail,
} from './helpers.js';

const PREFIX = '/api/v1';

describe('Users', () => {
  let admin;
  let adminToken;
  let user;
  let userToken;

  beforeEach(async () => {
    await resetDatabase();
    admin = await createAdmin({ name: 'Admin', email: 'admin@example.com' });
    adminToken = await login(admin.email);
    user = await createUser({ name: 'Regular', email: 'user@example.com' });
    userToken = await login(user.email);
  });

  describe('GET /users', () => {
    it('returns a paginated collection with the meta block', async () => {
      for (let index = 0; index < 12; index += 1) {
        await createUser({ name: `Extra ${index}` });
      }

      const response = await request.get(`${PREFIX}/users`).set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.message, 'Users retrieved');
      assert.ok(Array.isArray(response.body.data));
      assert.equal(response.body.data.length, 10);
      assert.equal(response.body.meta.page, 1);
      assert.equal(response.body.meta.limit, 10);
      assert.equal(response.body.meta.total, 14);
      assert.equal(response.body.meta.total_pages, 2);
    });

    it('never exposes the password field', async () => {
      const response = await request.get(`${PREFIX}/users`).set('Authorization', `Bearer ${adminToken}`);

      for (const row of response.body.data) {
        assert.equal('password' in row, false);
      }
    });

    it('supports the search parameter on name and email', async () => {
      const response = await request
        .get(`${PREFIX}/users`)
        .query({ search: 'user@example.com' })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 1);
      assert.equal(response.body.data[0].email, 'user@example.com');
    });

    it('supports sort and order', async () => {
      const response = await request
        .get(`${PREFIX}/users`)
        .query({ sort: 'name', order: 'asc' })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      const names = response.body.data.map((row) => row.name);
      assert.deepEqual(names, [...names].sort());
    });

    it('caps the limit at 100', async () => {
      const response = await request
        .get(`${PREFIX}/users`)
        .query({ limit: 500 })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.limit));
    });

    it('requires authentication', async () => {
      const response = await request.get(`${PREFIX}/users`);
      assert.equal(response.status, 401);
    });

    it('returns 403 for a regular user', async () => {
      const response = await request.get(`${PREFIX}/users`).set('Authorization', `Bearer ${userToken}`);
      assert.equal(response.status, 403);
    });
  });

  describe('GET /users/:id', () => {
    it('returns a single user for an admin', async () => {
      const response = await request.get(`${PREFIX}/users/${user.id}`).set('Authorization', `Bearer ${adminToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'User retrieved');
      assert.equal(response.body.data.id, user.id);
      assert.equal('password' in response.body.data, false);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request.get(`${PREFIX}/users/999999`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
    });

    it('returns 422 for a non numeric id', async () => {
      const response = await request.get(`${PREFIX}/users/abc`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.id));
    });
  });

  describe('GET /users/me', () => {
    it('returns the authenticated user without requiring the admin role', async () => {
      const response = await request.get(`${PREFIX}/users/me`).set('Authorization', `Bearer ${userToken}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.id, user.id);
      assert.equal(response.body.data.email, 'user@example.com');
      assert.equal('password' in response.body.data, false);
    });

    it('is not shadowed by the /users/:id route', async () => {
      const response = await request.get(`${PREFIX}/users/me`).set('Authorization', `Bearer ${userToken}`);
      assert.equal(response.body.data.role, 'user');
    });
  });

  describe('POST /users', () => {
    it('creates a user and never returns the password', async () => {
      const email = uniqueEmail('created');
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Created User', email, password: 'password', role: 'user' });

      assert.equal(response.status, 201);
      assert.equal(response.body.message, 'User created successfully');
      assert.equal(response.body.data.email, email);
      assert.equal('password' in response.body.data, false);
    });

    it('creates an admin when the role is admin', async () => {
      const email = uniqueEmail('newadmin');
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Second Admin', email, password: 'password', role: 'admin' });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.role, 'admin');
    });

    it('defaults the role to user', async () => {
      const email = uniqueEmail('defaultrole');
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Role', email, password: 'password' });

      assert.equal(response.status, 201);
      assert.equal(response.body.data.role, 'user');
    });

    it('returns 422 for a duplicate email', async () => {
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Dupe', email: 'user@example.com', password: 'password' });

      assert.equal(response.status, 422);
      assert.deepEqual(response.body.errors.email, ['The email has already been taken.']);
    });

    it('returns 422 for an invalid role', async () => {
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad Role', email: uniqueEmail('badrole'), password: 'password', role: 'superuser' });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.role));
    });

    it('returns 422 for a short password', async () => {
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Short', email: uniqueEmail('short'), password: 'abc' });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.password));
    });

    it('returns 403 for a regular user', async () => {
      const response = await request
        .post(`${PREFIX}/users`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Nope', email: uniqueEmail('nope'), password: 'password' });

      assert.equal(response.status, 403);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates a single field', async () => {
      const response = await request
        .patch(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Renamed' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.name, 'Renamed');
      assert.equal('password' in response.body.data, false);
    });

    it('changes the role', async () => {
      const response = await request
        .patch(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.role, 'admin');
    });

    it('allows keeping the same email', async () => {
      const response = await request
        .patch(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'user@example.com' });

      assert.equal(response.status, 200);
    });

    it('rejects an email owned by another user with 422', async () => {
      const other = await createUser({ email: 'other@example.com' });
      const response = await request
        .patch(`${PREFIX}/users/${other.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'user@example.com' });

      assert.equal(response.status, 422);
      assert.deepEqual(response.body.errors.email, ['The email has already been taken.']);
    });

    it('changes the password and keeps it out of the response', async () => {
      const response = await request
        .patch(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'newpassword' });

      assert.equal(response.status, 200);
      assert.equal('password' in response.body.data, false);

      const relogin = await request.post(`${PREFIX}/auth/login`).send({ email: 'user@example.com', password: 'newpassword' });
      assert.equal(relogin.status, 200);
    });
  });

  describe('PUT /users/:id', () => {
    it('replaces the resource', async () => {
      const email = uniqueEmail('replaced');
      const response = await request
        .put(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Replaced', email, password: 'password', role: 'user' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.email, email);
      assert.equal(response.body.data.name, 'Replaced');
    });

    it('returns 422 when required fields are missing', async () => {
      const response = await request
        .put(`${PREFIX}/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.name));
      assert.ok(Array.isArray(response.body.errors.email));
      assert.ok(Array.isArray(response.body.errors.password));
    });
  });

  describe('PATCH /users/me', () => {
    it('updates the profile and hides the password', async () => {
      const response = await request
        .patch(`${PREFIX}/users/me`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Self Updated', password: 'anotherpass', password_confirmation: 'anotherpass' });

      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'Profile updated successfully');
      assert.equal(response.body.data.name, 'Self Updated');
      assert.equal('password' in response.body.data, false);
    });

    it('cannot escalate the role', async () => {
      const response = await request
        .patch(`${PREFIX}/users/me`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.role, 'user');
    });

    it('requires a matching confirmation when changing the password', async () => {
      const response = await request
        .patch(`${PREFIX}/users/me`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'anotherpass', password_confirmation: 'mismatch' });

      assert.equal(response.status, 422);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes the user', async () => {
      const target = await createUser();

      const response = await request.delete(`${PREFIX}/users/${target.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.message, 'User deleted successfully');

      const after = await request.get(`${PREFIX}/users/${target.id}`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(after.status, 404);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request.delete(`${PREFIX}/users/999999`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 404);
    });

    it('returns 403 for a regular user', async () => {
      const response = await request.delete(`${PREFIX}/users/${user.id}`).set('Authorization', `Bearer ${userToken}`);
      assert.equal(response.status, 403);
    });
  });
});
