const { of, firstValueFrom } = require('rxjs');
const { TransformInterceptor } = require('./transform.interceptor');

/**
 * Minimal ExecutionContext stub that points at a given request URL.
 */
const contextFor = (url = '/api/v1/products') => ({
  switchToHttp: () => ({
    getRequest:  () => ({ originalUrl: url, url }),
    getResponse: () => ({}),
  }),
});

const handlerFor = (value) => ({ handle: () => of(value) });

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  it('wraps a plain value in the success envelope', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextFor(), handlerFor({ id: 1 })),
    );

    expect(result).toEqual({
      success: true,
      message: 'Request successful',
      data: { id: 1 },
    });
  });

  it('passes through a payload that already has the envelope shape', async () => {
    const payload = { data: { id: 2 }, message: 'Product created' };
    const result = await firstValueFrom(
      interceptor.intercept(contextFor(), handlerFor(payload)),
    );

    expect(result).toEqual({
      success: true,
      message: 'Product created',
      data: { id: 2 },
    });
  });

  it('adds meta when the payload has it', async () => {
    const payload = {
      data: [{ id: 1 }],
      message: 'Products retrieved',
      meta: { page: 1, limit: 10, total: 1, total_pages: 1 },
    };
    const result = await firstValueFrom(
      interceptor.intercept(contextFor(), handlerFor(payload)),
    );

    expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, total_pages: 1 });
  });

  it('does not wrap the /health endpoint response', async () => {
    const raw = { status: 'ok', uptime: 100, timestamp: '2024-01-01T00:00:00.000Z' };
    const result = await firstValueFrom(
      interceptor.intercept(contextFor('/health'), handlerFor(raw)),
    );

    // Health response passes through unchanged (no envelope)
    expect(result).toEqual(raw);
  });
});
