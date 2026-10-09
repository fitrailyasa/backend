import { Op } from 'sequelize';
import { body, param, query } from 'express-validator';
import env from '../config/env.js';
import { ORDER_STATUSES } from '../models/Order.js';
import { ROLES } from '../models/User.js';

export function uniqueIn(Model, field, { message, exceptFromParams = 'id' } = {}) {
  return async (value, { req }) => {
    const exceptId = exceptFromParams ? req.params?.[exceptFromParams] : undefined;
    const where = { [field]: value };
    if (exceptId !== undefined && exceptId !== null && String(exceptId) !== '') {
      where.id = { [Op.ne]: exceptId };
    }
    const existing = await Model.findOne({ where, attributes: ['id'] });
    if (existing) throw new Error(message);
    return true;
  };
}

export const paginationRules = (sortable = []) => [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: env.pagination.maxLimit })
    .withMessage(`Limit must be an integer between 1 and ${env.pagination.maxLimit}.`)
    .toInt(),
  query('search').optional().isString().withMessage('Search must be a string.').trim().isLength({ max: 150 }),
  query('sort')
    .optional()
    .isString()
    .withMessage('Sort must be a string.')
    .bail()
    .trim()
    .custom((value) => {
      if (sortable.length > 0 && !sortable.includes(value)) {
        throw new Error(`Sort must be one of: ${sortable.join(', ')}.`);
      }
      return true;
    }),
  query('order').optional().isString().withMessage('Order must be a string.').trim().toLowerCase().isIn(['asc', 'desc']).withMessage('Order must be either asc or desc.'),
];

export const includeRule = (...allowed) =>
  query('include')
    .optional()
    .isString()
    .withMessage('Include must be a comma separated string.')
    .custom((value) => {
      const entries = String(value)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      const invalid = entries.filter((entry) => !allowed.includes(entry));
      if (invalid.length > 0) {
        throw new Error(`Unsupported include value(s): ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}.`);
      }
      return true;
    });

export const idParam = (name = 'id') => [
  param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer.`).toInt(),
];

export const passwordRules = (field = 'password', confirmationField = 'password_confirmation') => [
  body(field).isString().withMessage('Password must be a string.').isLength({ min: 8, max: 72 }).withMessage('Password must be at least 8 characters long.'),
  body(confirmationField)
    .exists({ values: 'falsy' })
    .withMessage(`${confirmationField} is required.`)
    .bail()
    .isString()
    .custom((value, { req }) => value === req.body[field])
    .withMessage(`${confirmationField} must match ${field}.`),
];

export const emailRule = (message = 'The email must be a valid email address.') =>
  body('email')
    .exists({ values: 'falsy' })
    .withMessage('Email is required.')
    .bail()
    .isString()
    .bail()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('Email must be between 3 and 150 characters.')
    .bail()
    .isEmail()
    .withMessage(message)
    .normalizeEmail({ gmail_remove_dots: false });

export const orderStatusRule = (field = 'status') =>
  body(field)
    .exists({ values: 'falsy' })
    .withMessage('Status is required.')
    .bail()
    .isString()
    .withMessage('Status must be a string.')
    .bail()
    .isIn(ORDER_STATUSES)
    .withMessage(`Status must be one of: ${ORDER_STATUSES.join(', ')}.`);

export const roleRule = () =>
  body('role')
    .optional()
    .isString()
    .withMessage('Role must be a string.')
    .bail()
    .isIn(ROLES)
    .withMessage(`Role must be one of: ${ROLES.join(', ')}.`);

export default { uniqueIn, paginationRules, includeRule, idParam };
