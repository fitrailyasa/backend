import * as authService from '../services/authService.js';
import ApiError from '../utils/ApiError.js';
import { created, ok } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return created(res, 'User registered successfully', result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ok(res, 'Login successful', result);
});

export const refresh = asyncHandler(async (req, res) => {
  const header = req.headers.authorization || req.headers.Authorization;
  const bearer = typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  const token = req.body?.refresh_token ?? req.body?.token ?? bearer;
  if (!token) {
    throw ApiError.unauthorized('Refresh token is missing');
  }

  const result = await authService.refresh(token);
  return ok(res, 'Token refreshed successfully', result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.auth);
  return ok(res, 'Logged out successfully', null);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  return ok(res, 'Authenticated user retrieved', user);
});

export default { register, login, refresh, logout, me };
