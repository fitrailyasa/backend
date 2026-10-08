const { UnprocessableEntityException, HttpStatus, ValidationPipe } = require('@nestjs/common');

/**
 * Turns a class-validator tree into `{ field: ['message'] }` as required by the 422 contract.
 */
const flattenValidationErrors = (errors, parent = '') => {
  const out = {};

  for (const error of errors ?? []) {
    const path = parent ? `${parent}.${error.property}` : error.property;

    if (error.constraints) {
      out[path] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(out, flattenValidationErrors(error.children, path));
    }
  }

  return out;
};

const exceptionFactory = (errors) =>
  new UnprocessableEntityException({
    message: 'Validation failed',
    errors: flattenValidationErrors(errors),
  });

const VALIDATION_PIPE_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory,
};

const pipeFor = (metatype) => new ValidationPipe({ ...VALIDATION_PIPE_OPTIONS, expectedType: metatype });

module.exports = { flattenValidationErrors, exceptionFactory, VALIDATION_PIPE_OPTIONS, pipeFor };
