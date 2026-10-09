import { body } from 'express-validator';
import { idParam, paginationRules, includeRule } from './common.validator.js';

export const listRules = [...paginationRules(['id', 'name', 'slug', 'created_at', 'updated_at']), includeRule('products')];

export const showRules = [...idParam('id'), includeRule('products')];

export const storeRules = [
  body('name')
    .exists({ values: 'falsy' })
    .withMessage('Name is required.')
    .bail()
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),
  body('slug')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Slug must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Slug must be between 1 and 120 characters.')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug may only contain lowercase letters, numbers and single hyphens.'),
  body('description').optional({ values: 'falsy' }).isString().withMessage('Description must be a string.').trim(),
];

export const updateRules = [
  ...idParam('id'),
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),
  body('slug')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Slug must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Slug must be between 1 and 120 characters.')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug may only contain lowercase letters, numbers and single hyphens.'),
  body('description').optional({ values: 'falsy' }).isString().withMessage('Description must be a string.').trim(),
];

export default { listRules, showRules, storeRules, updateRules };
