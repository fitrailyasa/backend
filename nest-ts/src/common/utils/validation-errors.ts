import {
  HttpStatus,
  Type,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

/**
 * Flattens nested class-validator errors into the per field shape required by
 * the API contract: `{ email: ['The email has already been taken.'] }`.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors ?? []) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      result[path] = [...new Set(Object.values(error.constraints).map(String))];
    }

    if (error.children && error.children.length > 0) {
      Object.assign(result, flattenValidationErrors(error.children, path));
    }
  }

  return result;
}

/** Turns a class-validator tree into the 422 `{ message, errors }` payload. */
export function exceptionFactory(errors: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    message: 'Validation failed',
    errors: flattenValidationErrors(errors),
  });
}

/** Shared options for the global pipe and for the per parameter `Validated*` decorators. */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory,
};

/** A pipe preconfigured for one DTO, so `@ValidatedBody(CreateUserDto)` behaves like the global pipe. */
export function pipeFor(metatype: Type<unknown>): ValidationPipe {
  return new ValidationPipe({ ...VALIDATION_PIPE_OPTIONS, expectedType: metatype });
}
