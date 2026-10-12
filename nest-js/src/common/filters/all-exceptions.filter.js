const { Catch, HttpException, HttpStatus, Logger } = require('@nestjs/common');
const { EntityNotFoundError, QueryFailedError } = require('typeorm');

const logger = new Logger('AllExceptionsFilter');

const MESSAGES = {
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Resource not found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation failed',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

const DRIVER_MESSAGES = {
  ER_DUP_ENTRY: { status: HttpStatus.CONFLICT, message: 'Resource already exists.' },
  ER_NO_REFERENCED_ROW: { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Related resource does not exist.' },
  ER_NO_REFERENCED_ROW_2: { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Related resource does not exist.' },
  ER_ROW_IS_REFERENCED: { status: HttpStatus.CONFLICT, message: 'Resource is still referenced by other records.' },
  ER_ROW_IS_REFERENCED_2: { status: HttpStatus.CONFLICT, message: 'Resource is still referenced by other records.' },
};

/**
 * Maps every exception onto `{ success: false, message, errors? }` where `errors` only exists on 422.
 */
@Catch()
class AllExceptionsFilter {
  catch(exception, host) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const normalized = AllExceptionsFilter.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      logger.error(
        `${request?.method} ${request?.url} -> ${normalized.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body = { success: false, message: normalized.message };
    if (normalized.status === HttpStatus.UNPROCESSABLE_ENTITY && normalized.errors) {
      body.errors = normalized.errors;
    }

    response.status(normalized.status).json(body);
  }

  static normalize(exception) {
    if (exception instanceof HttpException) {
      return AllExceptionsFilter.fromHttp(exception);
    }

    if (exception instanceof QueryFailedError) {
      const code = exception.driverError?.code;
      const mapped = DRIVER_MESSAGES[code];
      if (mapped) return mapped;
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: MESSAGES[500] };
    }

    if (exception instanceof EntityNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: MESSAGES[404] };
    }

    if (exception instanceof SyntaxError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid JSON payload.' };
    }

    // body-parser / http-errors style errors (e.g. 413 request entity too
    // large) reach the filter as plain Errors carrying a 4xx status.
    const status = Number(exception?.status ?? exception?.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      return { status, message: AllExceptionsFilter.clientErrorMessage(status) };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: MESSAGES[500] };
  }

  static clientErrorMessage(status) {
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return 'Request entity too large';
    return MESSAGES[status] ?? 'Bad request';
  }

  static fromHttp(exception) {
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { status, message: status === 500 ? MESSAGES[500] : body };
    }

    const message =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? MESSAGES[500]
        : Array.isArray(body?.message)
          ? body.message.join(', ')
          : typeof body?.message === 'string'
            ? body.message
            : MESSAGES[status] ?? exception.message;

    const errors =
      status === HttpStatus.UNPROCESSABLE_ENTITY ? AllExceptionsFilter.resolveErrors(body) : undefined;

    return { status, message, errors };
  }

  static resolveErrors(body) {
    if (!body || typeof body !== 'object') return undefined;
    if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) {
      return body.errors;
    }

    const { statusCode, error, message, ...rest } = body;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }
}

module.exports = { AllExceptionsFilter };
