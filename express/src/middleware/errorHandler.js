import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const DATABASE_ERROR_MESSAGES = {
  ER_NO_SUCH_TABLE: 'Database table not found',
  ER_DUP_ENTRY: 'Resource already exists',
  ER_ROW_IS_REFERENCED: 'Resource is still referenced by other records',
  ER_ROW_IS_REFERENCED_2: 'Resource is still referenced by other records',
  ER_NO_REFERENCED_ROW: 'Referenced record does not exist',
  ER_BAD_NULL_ERROR: 'A required field was missing',
  ER_DATA_TOO_LONG: 'One of the values is too long',
};

function isBodyParserSyntaxError(error) {
  return error instanceof SyntaxError && error.status === 400 && 'body' in error;
}

function mapSequelizeValidationError(error) {
  const errors = {};
  for (const item of error.errors ?? []) {
    const key = item.path ?? '_';
    if (!errors[key]) errors[key] = [];
    errors[key].push(item.message);
  }
  return { statusCode: 422, message: 'Validation failed', errors };
}

function mapUniqueConstraintError(error) {
  const fields = error.fields ?? [];
  const slugField = fields.find((field) => field === 'slug');
  if (slugField) {
    return { statusCode: 409, message: 'The slug has already been taken' };
  }
  return { statusCode: 409, message: 'Resource already exists' };
}

function resolve(error) {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors,
      expose: true,
    };
  }

  if (isBodyParserSyntaxError(error)) {
    return { statusCode: 400, message: 'Invalid JSON payload', expose: true };
  }

  if (error.type === 'entity.too.large') {
    return { statusCode: 413, message: 'Payload too large', expose: true };
  }

  switch (error.name) {
    case 'ValidationError':
    case 'SequelizeValidationError':
      return { ...mapSequelizeValidationError(error), expose: true };
    case 'UniqueConstraintError':
    case 'SequelizeUniqueConstraintError':
      return { ...mapUniqueConstraintError(error), expose: true };
    case 'ForeignKeyConstraintError':
    case 'SequelizeForeignKeyConstraintError':
      return { statusCode: 409, message: 'Resource is still referenced by other records', expose: true };
    case 'EmptyResultError':
    case 'SequelizeEmptyResultError':
      return { statusCode: 404, message: 'Resource not found', expose: true };
    case 'TokenExpiredError':
      return { statusCode: 401, message: 'Token has expired', expose: true };
    case 'JsonWebTokenError':
      return { statusCode: 401, message: 'Token is invalid', expose: true };
    case 'NotBeforeError':
      return { statusCode: 401, message: 'Token is not active yet', expose: true };
    case 'SequelizeConnectionError':
    case 'SequelizeConnectionRefusedError':
    case 'SequelizeConnectionTimedOutError':
    case 'SequelizeHostNotFoundError':
    case 'SequelizeAccessDeniedError':
      return { statusCode: 500, message: 'Internal server error', expose: false };
    default:
      break;
  }

  if (error.parent?.code && DATABASE_ERROR_MESSAGES[error.parent.code]) {
    return { statusCode: 409, message: DATABASE_ERROR_MESSAGES[error.parent.code], expose: true };
  }

  if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    return { statusCode: error.statusCode, message: error.message, expose: true };
  }

  return { statusCode: 500, message: 'Internal server error', expose: false };
}

export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const { statusCode, message, errors, expose } = resolve(error);

  if (statusCode >= 500) {
    console.error(`[${res.locals.requestId ?? '-'}] ${req.method} ${req.originalUrl} ->`, error);
  }

  const body = { success: false, message: expose ? message : 'Internal server error' };
  if (statusCode === 422 && errors && Object.keys(errors).length > 0) {
    body.errors = errors;
  } else if (errors && expose && statusCode < 500) {
    body.errors = errors;
  }

  if (env.isProduction) delete body.errors;

  return res.status(statusCode).json(body);
}
