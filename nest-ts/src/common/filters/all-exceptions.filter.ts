import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { ApiFailure } from '../utils/api-response';

interface NormalizedError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Malformed request.',
  [HttpStatus.UNAUTHORIZED]: 'Unauthenticated.',
  [HttpStatus.FORBIDDEN]: 'Forbidden.',
  [HttpStatus.NOT_FOUND]: 'Resource not found.',
  [HttpStatus.CONFLICT]: 'Resource already exists.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Validation failed.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error.',
};

const DRIVER_ERROR_MESSAGES: Record<string, string> = {
  ER_DUP_ENTRY: 'Resource already exists.',
  ER_NO_REFERENCED_ROW: 'Related resource does not exist.',
  ER_NO_REFERENCED_ROW_2: 'Related resource does not exist.',
  ER_ROW_IS_REFERENCED: 'Resource is still referenced by other records.',
  ER_ROW_IS_REFERENCED_2: 'Resource is still referenced by other records.',
  ER_BAD_NULL_ERROR: 'A required field is missing.',
  ER_DATA_TOO_LONG: 'One of the provided values is too long.',
  ER_LOCK_WAIT_TIMEOUT: 'The resource is busy, please retry.',
  ER_LOCK_DEADLOCK: 'The resource is busy, please retry.',
};

/**
 * Single funnel for every error leaving the application. Turns exceptions into
 * the shared envelope: `{ success: false, message, errors? }`, where `errors`
 * is only present for 422 responses and 500 details never leak to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `${request?.method ?? '-'} ${request?.originalUrl ?? '-'} -> ${normalized.status}`,
        stack,
      );
    }

    const body: ApiFailure = { success: false, message: normalized.message };

    if (normalized.errors && Object.keys(normalized.errors).length > 0) {
      body.errors = normalized.errors;
    }

    response.status(normalized.status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof QueryFailedError) {
      const code = this.driverErrorCode(exception);
      const status =
        code && code.startsWith('ER_') && DRIVER_ERROR_MESSAGES[code]
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;

      return {
        status,
        message:
          DRIVER_ERROR_MESSAGES[code ?? ''] ??
          (status === HttpStatus.INTERNAL_SERVER_ERROR ? DEFAULT_MESSAGES[500] : 'Request failed.'),
      };
    }

    if (exception instanceof EntityNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: DEFAULT_MESSAGES[404] };
    }

    if (exception instanceof SyntaxError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Malformed JSON payload.' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_MESSAGES[500] };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const fallback = DEFAULT_MESSAGES[status] ?? exception.message;

    if (typeof payload === 'string') {
      return { status, message: payload };
    }

    if (typeof payload !== 'object' || payload === null) {
      return { status, message: fallback };
    }

    const body = payload as { message?: unknown; error?: unknown; errors?: unknown };
    const isDefaultNestMessage =
      typeof body.message === 'string' &&
      (body.message === 'Forbidden' ||
        body.message === 'Unauthorized' ||
        body.message === (body as { error?: unknown }).error ||
        body.message === exception.name.replace(/Exception$/, ''));

    const message = Array.isArray(body.message)
      ? body.message.filter((item): item is string => typeof item === 'string').join(', ')
      : typeof body.message === 'string' && !isDefaultNestMessage
        ? body.message
        : fallback;

    return { status, message, errors: this.toErrors(body.errors) };
  }

  private toErrors(value: unknown): Record<string, string[]> | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }

    const entries = Object.entries(value as Record<string, unknown>).map(([field, messages]) => [
      field,
      (Array.isArray(messages) ? messages : [messages]).map((item) => String(item)),
    ]);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  private driverErrorCode(exception: QueryFailedError): string | undefined {
    const driverError = exception.driverError as { code?: unknown } | undefined;

    if (driverError && typeof driverError.code === 'string') {
      return driverError.code;
    }

    return exception.message.match(/^([A-Z0-9_]+):/)?.[1];
  }
}
