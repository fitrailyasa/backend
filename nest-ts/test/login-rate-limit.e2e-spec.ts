/**
 * `_SECURITY_SPEC.md` section 1: failed logins are limited to 3 per email and
 * 10 per IP inside a sliding 15 minute window (429 + Retry-After + envelope
 * without `errors` once locked).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  LOGIN_LOCKED_MESSAGE,
  resetLoginRateLimits,
} from '../src/common/security/login-rate-limit.service';
import { hashPassword } from '../src/common/utils/password';
import { setupApp } from '../src/main';
import { User, UserRole } from '../src/users/entities/user.entity';

const PREFIX = '/api/v1';
const password = 'password';

let app: INestApplication;
let dataSource: DataSource;

const http = () => request(app.getHttpServer());

const createUser = async (email: string) => {
  const repository = dataSource.getRepository(User);

  return repository.save(
    repository.create({
      name: 'Rate Limited',
      email,
      password: await hashPassword(password),
      role: UserRole.USER,
    }),
  );
};

const attempt = (email: string, candidate = 'wrong-password') =>
  http().post(`${PREFIX}/auth/login`).send({ email, password: candidate });

const success = (email: string) => http().post(`${PREFIX}/auth/login`).send({ email, password });

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

describe('Login attempt limiter', () => {
  beforeEach(async () => {
    resetLoginRateLimits();
    await dataSource.synchronize(true);
  });

  it('answers 401 for the first 3 failures and 429 on the 4th attempt', async () => {
    const user = await createUser('locked@example.com');

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
    const user = await createUser('still-locked@example.com');

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
    const user = await createUser('generic@example.com');

    const wrongPassword = await attempt(user.email);
    const unknownEmail = await attempt('nobody@example.com');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    expect(JSON.stringify(wrongPassword.body)).not.toMatch(/password/i);
  });

  it('resets the counter on a successful login', async () => {
    const user = await createUser('resettable@example.com');

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
    const first = await createUser('a@example.com');
    const second = await createUser('b@example.com');

    for (let i = 0; i < 3; i += 1) await attempt(first.email);
    expect((await attempt(first.email)).status).toBe(429);

    const other = await success(second.email);
    expect(other.status).toBe(200);
    expect(other.body.data.token).toEqual(expect.any(String));
  });

  it('normalizes the email so case variants cannot bypass the limit', async () => {
    const user = await createUser('cased@example.com');

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

    const user = await createUser('ip-safe@example.com');
    const blocked = await success(user.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, message: LOGIN_LOCKED_MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });
});
