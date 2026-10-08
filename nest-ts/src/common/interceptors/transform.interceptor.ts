import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { ApiSuccess, isPaginated, toPageMeta } from '../utils/api-response';
import { serialize } from '../utils/serialize';

const DEFAULT_MESSAGE = 'Request completed successfully';

/**
 * Wraps every handler return value into the shared envelope:
 * `{ success, message, data }` plus `meta` for paginated payloads.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccess<unknown>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<unknown>> {
    const request = context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
    const path = String(request.originalUrl ?? request.url ?? '').split('?')[0];

    if (path === '/health' || path.endsWith('/health')) {
      return next.handle() as Observable<ApiSuccess<unknown>>;
    }

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_MESSAGE;

    return next.handle().pipe(map((data) => this.toEnvelope(data, message)));
  }

  private toEnvelope(data: T, message: string): ApiSuccess<unknown> {
    if (isPaginated(data)) {
      return {
        success: true,
        message,
        data: serialize(data.items) as unknown[],
        meta: toPageMeta(data.page, data.limit, data.total),
      };
    }

    return { success: true, message, data: serialize(data) };
  }
}
