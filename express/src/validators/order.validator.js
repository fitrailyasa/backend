import { body, query } from 'express-validator';
import { ORDER_STATUSES } from '../models/Order.js';
import { idParam, paginationRules, includeRule, orderStatusRule } from './common.validator.js';

export const listRules = [
  ...paginationRules(['id', 'status', 'total', 'user_id', 'created_at', 'updated_at']),
  includeRule('items', 'items.product', 'user'),
  query('status')
    .optional()
    .isString()
    .withMessage('Status must be a string.')
    .bail()
    .isIn(ORDER_STATUSES)
    .withMessage(`Status must be one of: ${ORDER_STATUSES.join(', ')}.`),
  query('user_id').optional().isInt({ min: 1 }).withMessage('user_id must be a positive integer.').toInt(),
];

export const showRules = [...idParam('id'), includeRule('items', 'items.product', 'user')];

export const storeRules = [
  body('items')
    .exists({ values: 'falsy' })
    .withMessage('Items is required.')
    .bail()
    .isArray({ min: 1, max: 100 })
    .withMessage('Items must be a non-empty array.')
    .bail()
    .custom((value) => {
      const seen = new Set();
      for (const [index, item] of value.entries()) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`items.${index} must be an object.`);
        }
        const productId = Number(item.product_id);
        if (!Number.isInteger(productId) || productId < 1) {
          throw new Error(`items.${index}.product_id must be a positive integer.`);
        }
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error(`items.${index}.quantity must be an integer greater than or equal to 1.`);
        }
        if (seen.has(productId)) {
          throw new Error(`items.${index}.product_id is duplicated, combine the quantities into a single item.`);
        }
        seen.add(productId);
      }
      return true;
    })
    .bail()
    .customSanitizer((value) =>
      value.map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })),
    ),
];

export const updateStatusRules = [...idParam('id'), orderStatusRule('status')];

export default { listRules, showRules, storeRules, updateStatusRules };
