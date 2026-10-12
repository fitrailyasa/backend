import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { request, createUser, resetDatabase, resetLoginRateLimits, uniqueEmail } from './helpers.js';

const PREFIX = '/api/v1';
const LOCK_MESSAGE = 'Too many failed login attempts. Please try again later.';

function attemptLogin(email, password = 'wrong-password') {
  return request.post(`${PREFIX}/auth/login`).send({ email, password });
}

describe('Security', () => {
  beforeEach(async () => {
    await resetDatabase();
    resetLoginRateLimits();
  });

  describe('login rate limiting', () => {
    it('returns 401 for three failed attempts and 429 for the fourth', async () => {
      const user = await createUser();

      for (let i = 0; i < 3; i += 1) {
        const response = await attemptLogin(user.email);
        assert.equal(response.status, 401);
        assert.equal(response.body.success, false);
      }

      const locked = await attemptLogin(user.email);
      assert.equal(locked.status, 429);
      assert.ok(Number(locked.headers['retry-after']) >= 1, 'expected Retry-After >= 1');
      assert.equal(locked.body.success, false);
      assert.equal(locked.body.message, LOCK_MESSAGE);
      assert.equal(locked.body.errors, undefined);
    });

    it('returns 429 for a correct password while the account is locked', async () => {
      const user = await createUser();

      for (let i = 0; i < 3; i += 1) await attemptLogin(user.email);

      const response = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'password' });
      assert.equal(response.status, 429);
      assert.equal(response.body.message, LOCK_MESSAGE);
      assert.equal(response.body.errors, undefined);
    });

    it('counts unknown-email failures toward the same email counter', async () => {
      const email = uniqueEmail('ghost');

      for (let i = 0; i < 3; i += 1) {
        const response = await attemptLogin(email);
        assert.equal(response.status, 401);
      }

      const locked = await attemptLogin(email);
      assert.equal(locked.status, 429);
      assert.equal(locked.body.message, LOCK_MESSAGE);
    });

    it('resets the counter after a successful login', async () => {
      const user = await createUser();

      await attemptLogin(user.email);
      await attemptLogin(user.email);

      const success = await request.post(`${PREFIX}/auth/login`).send({ email: user.email, password: 'password' });
      assert.equal(success.status, 200);

      for (let i = 0; i < 3; i += 1) {
        const response = await attemptLogin(user.email);
        assert.equal(response.status, 401);
      }
    });

    it('locks per email: locking one email does not lock another', async () => {
      const locked = await createUser();
      const other = await createUser();

      for (let i = 0; i < 3; i += 1) await attemptLogin(locked.email);

      const lockedAttempt = await attemptLogin(locked.email);
      assert.equal(lockedAttempt.status, 429);

      const otherFailure = await attemptLogin(other.email);
      assert.equal(otherFailure.status, 401);

      const otherSuccess = await request.post(`${PREFIX}/auth/login`).send({ email: other.email, password: 'password' });
      assert.equal(otherSuccess.status, 200);
    });

    it('keys the counter on the normalized email', async () => {
      const user = await createUser();

      for (let i = 0; i < 3; i += 1) {
        const response = await attemptLogin(`  ${user.email.toUpperCase()}  `);
        assert.equal(response.status, 401);
      }

      const locked = await attemptLogin(user.email);
      assert.equal(locked.status, 429);
    });
  });

  describe('auth hygiene', () => {
    it('answers wrong email and wrong password with one generic 401', async () => {
      const user = await createUser();

      const wrongPassword = await attemptLogin(user.email);
      const wrongEmail = await attemptLogin(uniqueEmail('ghost'));

      assert.equal(wrongPassword.status, 401);
      assert.equal(wrongEmail.status, 401);
      assert.equal(wrongPassword.body.message, wrongEmail.body.message);
      assert.equal(wrongPassword.body.errors, undefined);
      assert.equal(wrongEmail.body.errors, undefined);
    });
  });

  describe('hardening', () => {
    it('sends the security headers without a framework fingerprint', async () => {
      const response = await request.get('/health');

      assert.equal(response.headers['x-powered-by'], undefined);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['x-frame-options'], 'DENY');
      assert.equal(response.headers['referrer-policy'], 'no-referrer');
      assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
      assert.equal(response.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
      assert.match(response.headers['content-security-policy'], /default-src 'none'/);
      assert.equal(response.headers['strict-transport-security'], undefined);
    });

    it('relaxes the CSP for the Swagger UI page only', async () => {
      const docs = await request.get(`${PREFIX}/docs`);
      assert.equal(docs.status, 200);
      assert.match(docs.headers['content-security-policy'], /default-src 'self'/);

      const api = await request.get(`${PREFIX}/products`);
      assert.match(api.headers['content-security-policy'], /default-src 'none'/);
    });

    it('caps oversized payloads with the standard envelope', async () => {
      const response = await request.post(`${PREFIX}/auth/login`).send({
        email: 'big@example.com',
        password: 'password',
        padding: 'x'.repeat(200 * 1024),
      });

      assert.equal(response.status, 413);
      assert.equal(response.body.success, false);
      assert.equal(typeof response.body.message, 'string');
    });

    it('never reflects an origin outside the CORS allow-list', async () => {
      const response = await request.get(`${PREFIX}/products`).set('Origin', 'https://evil.example');

      assert.equal(response.headers['access-control-allow-origin'], undefined);
      assert.match(response.headers.vary ?? '', /Origin/);
    });

    it('allows a configured CORS origin and varies on Origin', async () => {
      const response = await request.get(`${PREFIX}/products`).set('Origin', 'http://localhost:5173');

      assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(response.headers['access-control-allow-credentials'], 'true');
      assert.match(response.headers.vary ?? '', /Origin/);
    });
  });
});
