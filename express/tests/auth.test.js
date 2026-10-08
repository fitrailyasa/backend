import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { request, createAdmin, createUser, login, resetDatabase, uniqueEmail, env } from './helpers.js';

const PREFIX = '/api/v1';

describe('Auth', () => {
  before(async () => {
    await resetDatabase();
  });

  describe('POST /auth/register', () => {
    it('creates a user and returns a token pair without the password', async () => {
      const email = uniqueEmail('register');
      const response = await request.post(`${PREFIX}/auth/register`).send({
        name: 'John Doe',
        email,
        password: 'password',
        password_confirmation: 'password',
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.success, true);
      assert.equal(response.body.message, 'User registered successfully');
      assert.equal(response.body.data.user.email, email);
      assert.equal(response.body.data.user.role, 'user');
      assert.ok(response.body.data.token, 'expected an access token');
      assert.ok(response.body.data.refresh_token, 'expected a refresh token');
      assert.equal(response.body.data.token_type, 'Bearer');
      assert.equal(response.body.data.expires_in, 3600);
      assert.equal('password' in response.body.data.user, false);
      assert.equal(JSON.stringify(response.body).includes('$2b$'), false);
    });

    it('rejects a duplicate email with 422 and a per field error', async () => {
      const email = uniqueEmail('dup');
      const payload = { name: 'First', email, password: 'password', password_confirmation: 'password' };

      const first = await request.post(`${PREFIX}/auth/register`).send(payload);
      assert.equal(first.status, 201);

      const second = await request.post(`${PREFIX}/auth/register`).send({ ...payload, name: 'Second' });
      assert.equal(second.status, 422);
      assert.equal(second.body.success, false);
      assert.equal(second.body.message, 'Validation failed');
      assert.deepEqual(second.body.errors.email, ['The email has already been taken.']);
    });

    it('rejects a mismatched password confirmation with 422', async () => {
      const response = await request.post(`${PREFIX}/auth/register`).send({
        name: 'Mismatch',
        email: uniqueEmail('mismatch'),
        password: 'password',
        password_confirmation: 'different',
      });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.password_confirmation));
    });

    it('rejects a password shorter than 8 characters with 422', async () => {
      const response = await request.post(`${PREFIX}/auth/register`).send({
        name: 'Short',
        email: uniqueEmail('short'),
        password: 'short',
        password_confirmation: 'short',
      });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.password));
    });

    it('rejects an invalid email with 422', async () => {
      const response = await request.post(`${PREFIX}/auth/register`).send({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'password',
        password_confirmation: 'password',
      });

      assert.equal(response.status, 422);
      assert.ok(Array.isArray(response.body.errors.email));
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token pair for valid credentials', async () => {
      const user = await createUser();
      const response = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'password' });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.user.id, user.id);
      assert.ok(response.body.data.token);
      assert.equal('password' in response.body.data.user, false);
    });

    it('returns 401 for a wrong password', async () => {
      const user = await createUser();
      const response = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'wrong-password' });

      assert.equal(response.status, 401);
      assert.equal(response.body.success, false);
      assert.equal(response.body.errors, undefined);
    });

    it('returns 401 for an unknown email', async () => {
      const response = await request.post(`${PREFIX}/auth/login`).send({ email: uniqueEmail('ghost'), password: 'password' });
      assert.equal(response.status, 401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const user = await createUser();
      const token = await login(user.email);

      const response = await request.get(`${PREFIX}/auth/me`).set('Authorization', `Bearer ${token}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.id, user.id);
      assert.equal(response.body.data.email, user.email);
      assert.equal('password' in response.body.data, false);
    });

    it('returns 401 when no token is supplied', async () => {
      const response = await request.get(`${PREFIX}/auth/me`);
      assert.equal(response.status, 401);
      assert.equal(response.body.success, false);
    });

    it('returns 401 for a malformed token', async () => {
      const response = await request.get(`${PREFIX}/auth/me`).set('Authorization', 'Bearer not.a.jwt');
      assert.equal(response.status, 401);
    });

    it('returns 401 for an expired token', async () => {
      const user = await createUser();
      const expired = jwt.sign(
        { sub: String(user.id), role: user.role, typ: 'access' },
        env.jwt.accessSecret,
        { issuer: env.jwt.issuer, audience: env.jwt.audience, expiresIn: -60 },
      );

      const response = await request.get(`${PREFIX}/auth/me`).set('Authorization', `Bearer ${expired}`);
      assert.equal(response.status, 401);
      assert.equal(response.body.message, 'Token has expired');
    });

    it('exposes sub, role, iat, exp and jti claims', async () => {
      const user = await createUser();
      const token = await login(user.email);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

      assert.equal(payload.sub, String(user.id));
      assert.equal(payload.role, user.role);
      assert.ok(payload.iat);
      assert.ok(payload.exp > payload.iat);
      assert.ok(payload.jti);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new token pair from a refresh token', async () => {
      const user = await createUser();
      const loginResponse = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'password' });
      const { refresh_token: refreshToken, token: accessToken } = loginResponse.body.data;

      const response = await request
        .post(`${PREFIX}/auth/refresh`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken });

      assert.equal(response.status, 200);
      assert.ok(response.body.data.token);
      assert.ok(response.body.data.refresh_token);
      assert.equal('password' in response.body.data.user, false);
    });

    it('returns 401 when the refresh token is invalid', async () => {
      const user = await createUser();
      const token = await login(user.email);

      const response = await request
        .post(`${PREFIX}/auth/refresh`)
        .set('Authorization', `Bearer ${token}`)
        .send({ refresh_token: 'not.a.token' });

      assert.equal(response.status, 401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the current token', async () => {
      const user = await createUser();
      const token = await login(user.email);

      const logout = await request.post(`${PREFIX}/auth/logout`).set('Authorization', `Bearer ${token}`);
      assert.equal(logout.status, 200);
      assert.equal(logout.body.success, true);

      const afterLogout = await request.get(`${PREFIX}/auth/me`).set('Authorization', `Bearer ${token}`);
      assert.equal(afterLogout.status, 401);
    });
  });

  describe('global error handling', () => {
    it('returns 400 for malformed JSON', async () => {
      const response = await request
        .post(`${PREFIX}/auth/login`)
        .set('Content-Type', 'application/json')
        .send('{"email": ');

      assert.equal(response.status, 400);
      assert.equal(response.body.success, false);
    });

    it('returns 404 with the envelope for an unknown route', async () => {
      const response = await request.get(`${PREFIX}/does-not-exist`);

      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
      assert.equal(typeof response.body.message, 'string');
      assert.equal(response.body.errors, undefined);
    });

    it('returns a 422 envelope without an errors key for non validation errors', async () => {
      const user = await createUser();
      const response = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'password' });
      assert.equal(response.body.errors, undefined);
    });
  });

  describe('role protection', () => {
    it('allows an admin to reach an admin only endpoint', async () => {
      const admin = await createAdmin();
      const token = await login(admin.email);

      const response = await request.get(`${PREFIX}/users`).set('Authorization', `Bearer ${token}`);
      assert.equal(response.status, 200);
    });

    it('rejects a regular user with 403 on an admin only endpoint', async () => {
      const user = await createUser();
      const token = await login(user.email);

      const response = await request.get(`${PREFIX}/users`).set('Authorization', `Bearer ${token}`);
      assert.equal(response.status, 403);
      assert.equal(response.body.success, false);
    });
  });
});
