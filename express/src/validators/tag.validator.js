import { body } from 'express-validator';
import { idParam, paginationRules, includeRule } from './common.validator.js';

export const listRules = [...paginationRules(), includeRule('products')];

export const showRules = [...idParam('id')];

export const storeRules = [
  body('name')
    .exists({ values: 'falsy' })
    .withMessage('Name is required.')
    .bail()
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
  body('slug')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Slug must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Slug must be between 1 and 80 characters.')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug may only contain lowercase letters, numbers and single hyphens.'),
];

export const updateRules = [
  ...idParam('id'),
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
  body('slug')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Slug must be a string.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Slug must be between 1 and 80 characters.')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug may only contain lowercase letters, numbers and single hyphens.'),
];

export default { listRules, showRules, storeRules, updateRules };
