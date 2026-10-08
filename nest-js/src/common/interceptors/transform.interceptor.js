const { Injectable } = require('@nestjs/common');
const { map } = require('rxjs/operators');
const { serialize } = require('../utils/serialize');

/**
 * Wraps successful handler results into `{ success, message, data, meta? }`.
 * `/health` stays a raw probe payload, matching the other starters.
 */
@Injectable()
class TransformInterceptor {
  intercept(context, next) {
    const request = context.switchToHttp().getRequest();
    const url = String(request.originalUrl ?? request.url ?? '');

    if (url.split('?')[0] === '/health' || url.split('?')[0].endsWith('/health')) {
      return next.handle();
    }

    return next.handle().pipe(map((payload) => TransformInterceptor.toEnvelope(payload)));
  }

  static toEnvelope(payload) {
    if (payload === undefined || payload === null) {
      return { success: true, message: 'Request successful', data: null };
    }

    if (
      typeof payload === 'object' &&
      Object.prototype.hasOwnProperty.call(payload, 'data') &&
      Object.prototype.hasOwnProperty.call(payload, 'message')
    ) {
      const body = {
        success: true,
        message: payload.message,
        data: serialize(payload.data),
      };

      if (payload.meta) body.meta = payload.meta;

      return body;
    }

    return { success: true, message: 'Request successful', data: serialize(payload) };
  }
}

module.exports = { TransformInterceptor };
