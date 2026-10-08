const { request } = require('./helpers');

describe('probe', () => {
  it('inspects the swagger endpoints', async () => {
    const html = await request.get('/api/v1/docs');
    // eslint-disable-next-line no-console
    console.log('HTML status', html.status, html.headers['content-type']);
    // eslint-disable-next-line no-console
    console.log('HTML body', String(html.text).slice(0, 1200));

    const json = await request.get('/api/v1/docs.json');
    // eslint-disable-next-line no-console
    console.log('JSON status', json.status, json.body && Object.keys(json.body));
    // eslint-disable-next-line no-console
    console.log('paths', json.body && Object.keys(json.body.paths || {}).slice(0, 8));
    // eslint-disable-next-line no-console
    console.log('health', JSON.stringify(await request.get('/health')));
    const index = await request.get('/api/v1');
    // eslint-disable-next-line no-console
    console.log('index', index.status, JSON.stringify(index.body).slice(0, 400));
  });
});
