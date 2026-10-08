import { body, query } from 'express-validator';
import { idParam, paginationRules, includeRule } from './common.validator.js';

export const listRules = [
  ...paginationRules(),
  includeRule('user', 'product'),
  query('product_id').optional().isInt({ min: 1 }).withMessage('product_id must be a positive integer.').toInt(),
  query('user_id').optional().isInt({ min: 1 }).withMessage('user_id must be a positive integer.').toInt(),
];

export const listByProductRules = [
  ...idParam('productId'),
  ...paginationRules(),
  includeRule('user', 'product'),
  query('product_id').optional().isInt({ min: 1 }).withMessage('product_id must be a positive integer.').toInt(),
];

export const storeRules = [
  ...idParam('productId'),
  body('body')
    .exists({ values: 'falsy' })
    .withMessage('Body is required.')
    .bail()
    .isString()
    .withMessage('Body must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Body must be between 1 and 2000 characters.'),
];

export const showRules = [...idParam('id')];

export const updateRules = [
  ...idParam('id'),
  body('body')
    .exists({ values: 'falsy' })
    .withMessage('Body is required.')
    .bail()
    .isString()
    .withMessage('Body must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Body must be between 1 and 2000 characters.'),
];

export default { listRules, listByProductRules, showRules, storeRules, updateRules };
