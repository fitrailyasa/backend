import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

export default function validate(chains = []) {
  const list = Array.isArray(chains) ? chains.flat() : [chains];

  return async function validateRequest(req, res, next) {
    try {
      await Promise.all(list.map((chain) => chain.run(req)));

      const result = validationResult(req);
      if (result.isEmpty()) return next();

      const errors = {};
      for (const error of result.array()) {
        const key = error.path ?? error.param ?? '_';
        if (!errors[key]) errors[key] = [];
        errors[key].push(error.msg);
      }

      return next(ApiError.unprocessable('Validation failed', errors));
    } catch (error) {
      return next(error);
    }
  };
}
