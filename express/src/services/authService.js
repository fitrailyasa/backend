import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '../utils/password.js';
import { issueTokenPair, verifyRefreshToken, ttlSecondsFrom } from '../utils/jwt.js';
import { blacklistToken } from '../utils/tokenBlacklist.js';
import env from '../config/env.js';

export async function register({ name, email, password }) {
  const existing = await User.unscoped().findOne({ where: { email }, attributes: ['id'] });
  if (existing) {
    throw ApiError.unprocessable('Validation failed', { email: ['The email has already been taken.'] });
  }

  const user = await User.create({ name, email, password, role: 'user' });

  return { user, ...issueTokenPair(user) };
}

export async function login({ email, password }) {
  const user = await User.unscoped().findOne({ where: { email } });

  if (!user) {
    // Spend comparable time on unknown accounts so timing cannot be used to
    // probe which emails are registered. One generic 401 for every failure.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    throw ApiError.unauthorized('These credentials do not match our records');
  }

  const matches = await verifyPassword(password, user.password);
  if (!matches) {
    throw ApiError.unauthorized('These credentials do not match our records');
  }

  return { user, ...issueTokenPair(user) };
}

export async function refresh(token) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw ApiError.unauthorized('Token has expired');
    throw ApiError.unauthorized('Token is invalid');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) throw ApiError.unauthorized('Token is invalid');

  return { user, ...issueTokenPair(user) };
}

export async function logout(payload) {
  blacklistToken(payload, ttlSecondsFrom(payload, env.jwt.expiresIn));
  return true;
}

export async function me(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.unauthorized('Token is invalid');
  return user;
}

export default { register, login, refresh, logout, me };
