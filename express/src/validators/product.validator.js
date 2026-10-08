import { body, query } from 'express-validator';
import { idParam, paginationRules, includeRule } from './common.validator.js';

export const listRules = [
  ...paginationRules(),
  includeRule('category', 'tags'),
  query('category_id').optional().isInt({ min: 1 }).withMessage('category_id must be a positive integer.').toInt(),
  query('tag_id').optional().isInt({ min: 1 }).withMessage('tag_id must be a positive integer.').toInt(),
  query('tag').optional().isString().withMessage('tag must be a string.').trim(),
  query('min_price').optional().isFloat({ min: 0 }).withMessage('min_price must be a number greater than or equal to 0.'),
  query('max_price').optional().isFloat({ min: 0 }).withMessage('max_price must be a number greater than or equal to 0.'),
];

export const showRules = [...idParam('id'), includeRule('category', 'tags')];

function requiredChain(field, message) {
  return body(field)
    .exists({ values: 'falsy' })
    .withMessage(message)
    .bail();
}

function optionalChain(field) {
  return body(field).optional();
}

const categoryRule = () =>
  requiredChain('category_id', 'category_id is required.')
    .isInt({ min: 1 })
    .withMessage('category_id must be a positive integer.')
    .toInt();

const nameRule = (required) => {
  const chain = required ? requiredChain('name', 'Name is required.') : optionalChain('name');
  return chain
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Name must be between 2 and 150 characters.');
};

const priceRule = (required) => {
  const chain = required ? requiredChain('price', 'Price is required.') : optionalChain('price');
  return chain
    .isFloat({ min: 0 })
    .withMessage('Price must be a number greater than or equal to 0.')
    .toFloat();
};

const slugRule = body('slug')
  .optional({ values: 'falsy' })
  .isString()
  .withMessage('Slug must be a string.')
  .bail()
  .trim()
  .isLength({ min: 1, max: 180 })
  .withMessage('Slug must be between 1 and 180 characters.')
  .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .withMessage('Slug may only contain lowercase letters, numbers and single hyphens.');

const tagsRule = body('tags')
  .optional()
  .isArray({ min: 1, max: 20 })
  .withMessage('tags must be an array of tag ids.')
  .bail()
  .custom((value) => {
    const valid = value.every((entry) => Number.isInteger(Number(entry)) && Number(entry) > 0);
    if (!valid) throw new Error('tags must be an array of positive integers.');
    return true;
  })
  .bail()
  .customSanitizer((value) => value.map((entry) => Number(entry)));

export const storeRules = [
  categoryRule(),
  nameRule(true),
  slugRule,
  body('description').optional({ values: 'falsy' }).isString().withMessage('Description must be a string.').trim(),
  priceRule(true),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be an integer greater than or equal to 0.').toInt(),
  tagsRule,
];

export const updateRules = [
  ...idParam('id'),
  body('category_id').optional().isInt({ min: 1 }).withMessage('category_id must be a positive integer.').toInt(),
  nameRule(false),
  slugRule,
  body('description').optional({ values: 'falsy' }).isString().withMessage('Description must be a string.').trim(),
  priceRule(false),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be an integer greater than or equal to 0.').toInt(),
  tagsRule,
];

export default { listRules, showRules, storeRules, updateRules };
