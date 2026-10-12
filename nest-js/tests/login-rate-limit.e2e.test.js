/**
 * `_SECURITY_SPEC.md` section 1: failed logins are limited to 3 per email and
 * 10 per IP inside a sliding 15 minute window (429 + Retry-After + envelope
 * without `errors` once locked).
 */
const { PREFIX, createUser, request, resetDatabase } = require('./helpers');
const { LOGIN_LOCKED_MESSAGE, resetLoginRateLimits } = require('../src/common/security/login-rate-limit.service');

const attempt = (email, password = 'wrong-password') =>
  request.post(`${PREFIX}/auth/login`).send({ email, password });

const success = (email, password = 'password') =>
  request.post(`${PREFIX}/auth/login`).send({ email, password });

describe('Login attempt limiter', () => {
  beforeEach(async () => {
    resetLoginRateLimits();
    await resetDatabase();
  });

  it('answers 401 for the first 3 failures and 429 on the 4th attempt', async () => {
    const user = await createUser({ email: 'locked@example.com' });

    for (let i = 0; i < 3; i += 1) {
      const response = await attempt(user.email);
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeUndefined();
    }

    const blocked = await attempt(user.email);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(blocked.body).toEqual({ success: false, message: LOGIN_LOCKED_MESSAGE });
    expect(blocked.body.errors).toBeUndefined();
  });

  it('rejects a correct password while locked, before verifying it', async () => {
    const user = await createUser({ email: 'still-locked@example.com' });

    for (let i = 0; i < 3; i += 1) await attempt(user.email);

    const blocked = await success(user.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, message: LOGIN_LOCKED_MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('counts unknown-email failures toward the same email counter', async () => {
    for (let i = 0; i < 3; i += 1) {
      const response = await attempt('ghost@example.com');
      expect(response.status).toBe(401);
    }

    const blocked = await attempt('ghost@example.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, message: LOGIN_LOCKED_MESSAGE });
  });

  it('answers one generic 401 for wrong email and wrong password', async () => {
    const user = await createUser({ email: 'generic@example.com' });

    const wrongPassword = await attempt(user.email);
    const unknownEmail = await attempt('nobody@example.com');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    expect(JSON.stringify(wrongPassword.body)).not.toMatch(/password/i);
  });

  it('resets the counter on a successful login', async () => {
    const user = await createUser({ email: 'resettable@example.com' });

    await attempt(user.email); // failure 1
    await attempt(user.email); // failure 2

    const loggedIn = await success(user.email);
    expect(loggedIn.status).toBe(200);

    // the two earlier failures are gone: three more are allowed before locking
    for (let i = 0; i < 3; i += 1) {
      const response = await attempt(user.email);
      expect(response.status).toBe(401);
    }

    const blocked = await attempt(user.email);
    expect(blocked.status).toBe(429);
  });

  it('locks one email without locking another', async () => {
    const first = await createUser({ email: 'a@example.com' });
    const second = await createUser({ email: 'b@example.com' });

    for (let i = 0; i < 3; i += 1) await attempt(first.email);
    expect((await attempt(first.email)).status).toBe(429);

    const other = await success(second.email);
    expect(other.status).toBe(200);
    expect(other.body.data.token).toEqual(expect.any(String));
  });

  it('normalizes the email so case variants cannot bypass the limit', async () => {
    const user = await createUser({ email: 'cased@example.com' });

    for (let i = 0; i < 3; i += 1) await attempt('CASED@example.com');

    const blocked = await attempt('Cased@Example.com');
    expect(blocked.status).toBe(429);
    expect(user.email).toBe('cased@example.com');
  });

  it('locks the whole IP after 10 failures across different emails', async () => {
    for (let i = 0; i < 10; i += 1) {
      const response = await attempt(`hunter${i}@example.com`);
      expect(response.status).toBe(401);
    }

    const user = await createUser({ email: 'ip-safe@example.com' });
    const blocked = await success(user.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, message: LOGIN_LOCKED_MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});
