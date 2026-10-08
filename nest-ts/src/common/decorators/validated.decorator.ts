import { Body, Param, Query, Type } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS, pipeFor } from '../utils/validation-errors';

/**
 * Parameter decorators applying the shared validation pipe to a single DTO, so a
 * route can opt a parameter into the same whitelist / transform / 422 rules the
 * global pipe enforces while still declaring its own type.
 */
export const ValidatedBody = <T>(metatype: Type<T>): ParameterDecorator => Body(pipeFor(metatype));

export const ValidatedQuery = <T>(metatype: Type<T>): ParameterDecorator => Query(pipeFor(metatype));

export const ValidatedParam = (name: string, metatype: Type<unknown>): ParameterDecorator =>
  Param(name, pipeFor(metatype));

export { VALIDATION_PIPE_OPTIONS };
