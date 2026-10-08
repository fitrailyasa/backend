import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { request, resetDatabase } from './helpers.js';

const PREFIX = '/api/v1';

describe('Health & docs', () => {
  before(async () => {
    await resetDatabase();
  });

  describe('GET /health', () => {
    it('answers with a raw liveness payload', async () => {
      const response = await request.get('/health');

      assert.equal(response.status, 200);
      assert.equal(response.body.status, 'ok');
      assert.equal(typeof response.body.uptime, 'number');
      assert.equal(typeof response.body.timestamp, 'string');
      assert.equal('success' in response.body, false);
    });
  });

  describe('GET /api/v1', () => {
    it('lists the available routes inside the envelope', async () => {
      const response = await request.get(PREFIX);

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.message, 'API index retrieved');
      assert.equal(response.body.data.prefix, PREFIX);
      assert.ok(Array.isArray(response.body.data.endpoints));
      assert.ok(response.body.data.endpoints.length > 30);
      assert.equal(response.body.data.documentation, `${PREFIX}/docs`);
    });
  });

  describe('GET /api/v1/docs', () => {
    it('serves the Swagger UI page', async () => {
      const response = await request.get(`${PREFIX}/docs`);

      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.text, /<div id="swagger-ui">/);
      assert.match(response.text, new RegExp(`${PREFIX}/docs/swagger-ui-bundle\\.js`));
      assert.match(response.text, new RegExp(`${PREFIX}/docs/swagger-ui-init\\.js`));
    });

    it('serves the swagger-ui assets referenced by the page', async () => {
      const bundle = await request.get(`${PREFIX}/docs/swagger-ui-bundle.js`);
      const css = await request.get(`${PREFIX}/docs/swagger-ui.css`);

      assert.equal(bundle.status, 200);
      assert.match(bundle.headers['content-type'], /javascript/);
      assert.equal(css.status, 200);
      assert.match(css.headers['content-type'], /css/);
    });

    it('serves the generated init script with the document embedded', async () => {
      const response = await request.get(`${PREFIX}/docs/swagger-ui-init.js`);

      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'], /javascript/);
      assert.match(response.text, /var options =/);
      assert.match(response.text, /"openapi":\s*"3\.0\.3"/);
    });
  });

  describe('GET /api/v1/docs.json', () => {
    it('returns the OpenAPI 3.0 document', async () => {
      const response = await request.get(`${PREFIX}/docs.json`);

      assert.equal(response.status, 200);
      assert.equal(response.body.openapi, '3.0.3');
      assert.equal(response.body.info.title, 'Backend Starter Kit API');
      assert.equal(response.body.servers[0].url, PREFIX);
      assert.ok(response.body.paths['/auth/login']);
      assert.ok(response.body.paths['/products']);
      assert.ok(response.body.paths['/docs']);
    });
  });
});
