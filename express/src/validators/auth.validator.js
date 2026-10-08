import { body } from 'express-validator';
import { User } from '../models/index.js';
import { emailRule, passwordRules } from './common.validator.js';

async function ensureEmailAvailable(value) {
  const existing = await User.unscoped().findOne({ where: { email: value }, attributes: ['id'] });
  if (existing) throw new Error('The email has already been taken.');
  return true;
}

export const registerRules = [
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
  emailRule().custom(ensureEmailAvailable),
  ...passwordRules(),
];

export const loginRules = [
  emailRule(),
  body('password')
    .exists({ values: 'falsy' })
    .withMessage('Password is required.')
    .bail()
    .isString()
    .withMessage('Password must be a string.'),
];

export default { registerRules, loginRules };
