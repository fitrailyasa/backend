import { Op } from 'sequelize';
import { body } from 'express-validator';
import { User } from '../models/index.js';
import { emailRule, roleRule, uniqueIn, idParam, paginationRules } from './common.validator.js';

const uniqueEmail = uniqueIn(User, 'email', { message: 'The email has already been taken.' });

function nameChain({ required }) {
  const chain = body('name');
  if (required) {
    chain.exists({ values: 'falsy' }).withMessage('Name is required.').bail();
  } else {
    chain.optional();
  }
  return chain
    .isString()
    .withMessage('Name must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.');
}

function emailChain({ required, unique }) {
  const chain = required ? emailRule('Email is required.') : body('email').optional();
  if (required) return unique ? chain.custom(uniqueEmail) : chain;

  return chain
    .isString()
    .withMessage('Email must be a string.')
    .bail()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('Email must be between 3 and 150 characters.')
    .bail()
    .isEmail()
    .withMessage('The email must be a valid email address.')
    .bail()
    .normalizeEmail({ gmail_remove_dots: false })
    .custom(unique);
}

function passwordChain({ required }) {
  const chain = body('password');
  if (required) {
    chain.exists({ values: 'falsy' }).withMessage('Password is required.').bail();
  } else {
    chain.optional();
  }
  return chain
    .isString()
    .withMessage('Password must be a string.')
    .bail()
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be at least 8 characters long.');
}

export const listRules = [...paginationRules(['id', 'name', 'email', 'role', 'created_at', 'updated_at'])];

export const showRules = [...idParam('id')];

export const storeRules = [
  nameChain({ required: true }),
  emailChain({ required: true, unique: uniqueEmail }),
  passwordChain({ required: true }),
  roleRule(),
];

export const updateRules = [
  ...idParam('id'),
  nameChain({ required: false }),
  emailChain({ required: false, unique: uniqueEmail }),
  passwordChain({ required: false }),
  roleRule(),
];

export const profileUpdateRules = [
  nameChain({ required: false }),
  emailChain({
    required: false,
    unique: async (value, { req }) => {
      const existing = await User.unscoped().findOne({
        where: { email: value, id: { [Op.ne]: req.user.id } },
        attributes: ['id'],
      });
      if (existing) throw new Error('The email has already been taken.');
      return true;
    },
  }),
  passwordChain({ required: false }),
  body('password_confirmation')
    .optional({ values: 'falsy' })
    .custom((value, { req }) => {
      if (!req.body.password) throw new Error('Password is required when password_confirmation is provided.');
      if (value !== req.body.password) throw new Error('password_confirmation must match password.');
      return true;
    }),
];

export default { listRules, showRules, storeRules, updateRules, profileUpdateRules };
