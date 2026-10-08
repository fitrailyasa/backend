import * as userService from '../services/userService.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const { rows, meta } = await userService.list(req.query);
  return paginated(res, 'Users retrieved', rows, meta);
});

export const show = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  return ok(res, 'User retrieved', user);
});

export const me = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  return ok(res, 'User retrieved', user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  return ok(res, 'Profile updated successfully', user);
});

export const store = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  return created(res, 'User created successfully', user);
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  return ok(res, 'User updated successfully', user);
});

export const destroy = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id);
  return ok(res, 'User deleted successfully', null);
});

export default { index, show, me, updateMe, store, update, destroy };
