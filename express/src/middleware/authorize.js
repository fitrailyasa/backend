import ApiError from '../utils/ApiError.js';

export default function authorize(...roles) {
  const allowed = roles.flat().filter(Boolean);

  return function authorizeRoles(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication token is missing'));
    }
    if (allowed.length === 0 || allowed.includes(req.user.role)) {
      return next();
    }
    return next(ApiError.forbidden('This action is unauthorized'));
  };
}
