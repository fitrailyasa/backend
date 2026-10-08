const { Body, Query, Param } = require('@nestjs/common');
const { pipeFor, VALIDATION_PIPE_OPTIONS } = require('../utils/validation-errors');

/** @param {new (...args: any[]) => object} metatype */
const ValidatedBody = (metatype) => Body(pipeFor(metatype));

/** @param {new (...args: any[]) => object} metatype */
const ValidatedQuery = (metatype) => Query(pipeFor(metatype));

/** @param {string} name @param {new (...args: any[]) => object} metatype */
const ValidatedParam = (name, metatype) => Param(name, pipeFor(metatype));

module.exports = { ValidatedBody, ValidatedQuery, ValidatedParam, VALIDATION_PIPE_OPTIONS };
