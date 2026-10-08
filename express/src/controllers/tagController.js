import * as tagService from '../services/tagService.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const { rows, meta } = await tagService.list(req.query);
  return paginated(res, 'Tags retrieved', rows, meta);
});

export const show = asyncHandler(async (req, res) => {
  const tag = await tagService.getById(req.params.id);
  return ok(res, 'Tag retrieved', tag);
});

export const store = asyncHandler(async (req, res) => {
  const tag = await tagService.create(req.body);
  return created(res, 'Tag created successfully', tag);
});

export const update = asyncHandler(async (req, res) => {
  const tag = await tagService.update(req.params.id, req.body);
  return ok(res, 'Tag updated successfully', tag);
});

export const destroy = asyncHandler(async (req, res) => {
  await tagService.remove(req.params.id);
  return ok(res, 'Tag deleted successfully', null);
});

export default { index, show, store, update, destroy };
