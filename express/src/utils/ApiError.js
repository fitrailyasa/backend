export default class ApiError extends Error {
  constructor(statusCode, message, { errors, code, cause, isOperational = true } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Unauthenticated', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'This action is unauthorized', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Resource already exists', options) {
    return new ApiError(409, message, options);
  }

  static unprocessable(message = 'Validation failed', errors) {
    return new ApiError(422, message, { errors });
  }

  static tooManyRequests(message = 'Too many requests', options) {
    return new ApiError(429, message, options);
  }

  static internal(message = 'Internal server error', options) {
    return new ApiError(500, message, { ...options, isOperational: false });
  }
}

export const badRequest = ApiError.badRequest;
export const unauthorized = ApiError.unauthorized;
export const forbidden = ApiError.forbidden;
export const notFound = ApiError.notFound;
export const conflict = ApiError.conflict;
export const unprocessable = ApiError.unprocessable;
export const tooManyRequests = ApiError.tooManyRequests;
