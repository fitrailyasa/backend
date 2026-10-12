/**
 * `_SECURITY_SPEC.md` section 3: security headers, fingerprint removal, CORS
 * allowlist, 100kb body cap and sanitized errors.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/main';

const PREFIX = '/api/v1';
const BIG_NAME = 'x'.repeat(200000);

let app: INestApplication;

const http = () => request(app.getHttpServer());

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await setupApp(app);
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('Security hardening', () => {
  it('sets the security headers and hides the framework fingerprint', async () => {
    const response = await http().get(`${PREFIX}/products`);

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['permissions-policy']).toContain('microphone=()');
    expect(response.headers['permissions-policy']).toContain('geolocation=()');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
    expect(response.headers.vary).toContain('Origin');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers.server).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('keeps the headers on error responses', async () => {
    const missing = await http().get(`${PREFIX}/products/99999999`);

    expect(missing.status).toBe(404);
    expect(missing.headers['content-security-policy']).toBe("default-src 'none'");
    expect(missing.headers['x-frame-options']).toBe('DENY');
    expect(missing.body.success).toBe(false);
    expect(missing.body.message).toEqual(expect.any(String));
  });

  it('relaxes the CSP only for the Swagger UI page', async () => {
    const docs = await http().get('/api/v1/docs');

    expect(docs.status).toBe(200);
    expect(docs.headers['content-security-policy']).toContain("default-src 'self'");
    expect(docs.headers['x-frame-options']).toBe('DENY');

    const document = await http().get(`${PREFIX}/docs.json`);
    expect(document.status).toBe(200);
    expect(document.headers['content-security-policy']).toBe("default-src 'none'");
  });

  it('keeps CORS to the allowlist and never combines origins with * credentials', async () => {
    const allowed = await http().get('/health').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(allowed.headers['access-control-allow-origin']).not.toBe('*');
    expect(allowed.headers.vary).toContain('Origin');

    const denied = await http().get('/health').set('Origin', 'http://evil.test');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await http()
      .options(`${PREFIX}/products`)
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(preflight.headers['access-control-max-age']).toBe('600');
  });

  it('caps request bodies at 100kb and answers 413 with the error envelope', async () => {
    const response = await http().post(`${PREFIX}/auth/register`).send({
      name: BIG_NAME,
      email: 'big@example.com',
      password: 'password',
      password_confirmation: 'password',
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, message: 'Request entity too large' });
    expect(response.body.errors).toBeUndefined();
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
  });

  it('keeps invalid JSON a 400 with the error envelope', async () => {
    const response = await http()
      .post(`${PREFIX}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toEqual(expect.any(String));
    expect(response.body.errors).toBeUndefined();
  });
});
