import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { Paginated } from '../utils/api-response';
import { TransformInterceptor } from './transform.interceptor';

const contextFor = (handler: () => void, url = '/api/v1/products'): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => class HealthController {},
    switchToHttp: () => ({
      getRequest: () => ({ url, originalUrl: url }),
    }),
  }) as unknown as ExecutionContext;

const handlerFor = (value: unknown): CallHandler => ({ handle: () => of(value) });

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor(new Reflector());

  it('wraps a plain value in the success envelope', async () => {
    const handler = (): void => undefined;
    const result = await firstValueFrom(
      interceptor.intercept(contextFor(handler), handlerFor({ id: 1 })),
    );

    expect(result).toEqual({
      success: true,
      message: 'Request completed successfully',
      data: { id: 1 },
    });
  });

  it('uses the message declared with @ResponseMessage', async () => {
    const handler = (): void => undefined;

    Reflect.defineMetadata(RESPONSE_MESSAGE_KEY, 'Product created', handler);

    const result = await firstValueFrom(
      interceptor.intercept(contextFor(handler), handlerFor({ id: 1 })),
    );

    expect(result.message).toBe('Product created');
  });

  it('unwraps paginated results and adds page meta', async () => {
    const paginated = new Paginated([{ id: 1 }, { id: 2 }], 12, 2, 5);
    const result = await firstValueFrom(
      interceptor.intercept(contextFor((): void => undefined), handlerFor(paginated)),
    );

    expect(result).toEqual({
      success: true,
      message: 'Request completed successfully',
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 2, limit: 5, total: 12, total_pages: 3 },
    });
  });

  it('leaves GET /health unwrapped', async () => {
    const payload = { status: 'ok', uptime: 1, timestamp: '2026-01-01T00:00:00.000Z' };
    const result = await firstValueFrom(
      interceptor.intercept(contextFor((): void => undefined, '/health'), handlerFor(payload)),
    );

    expect(result).toEqual(payload);
  });

  it('keeps a delete payload as data', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextFor((): void => undefined), handlerFor({ id: 7 })),
    );

    expect(result.data).toEqual({ id: 7 });
  });
});
