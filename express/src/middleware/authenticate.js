import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { isBlacklisted } from '../utils/tokenBlacklist.js';

function extractBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

export default function authenticate(req, res, next) {
  const token = extractBearer(req);

  if (!token) {
    return next(ApiError.unauthorized('Authentication token is missing'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token has expired'));
    }
    return next(ApiError.unauthorized('Token is invalid'));
  }

  if (isBlacklisted(payload)) {
    return next(ApiError.unauthorized('Token has been revoked'));
  }

  return User.findByPk(payload.sub)
    .then((user) => {
      if (!user) return next(ApiError.unauthorized('Token is invalid'));
      req.user = user;
      req.auth = payload;
      req.token = token;
      return next();
    })
    .catch(next);
}
