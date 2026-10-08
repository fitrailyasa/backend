import * as commentService from '../services/commentService.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const { rows, meta } = await commentService.list(req.query);
  return paginated(res, 'Comments retrieved', rows, meta);
});

export const indexByProduct = asyncHandler(async (req, res) => {
  const { rows, meta } = await commentService.listByProduct(req.params.productId, req.query);
  return paginated(res, 'Comments retrieved', rows, meta);
});

export const store = asyncHandler(async (req, res) => {
  const comment = await commentService.create(req.params.productId, req.body, req.user);
  return created(res, 'Comment created successfully', comment);
});

export const update = asyncHandler(async (req, res) => {
  const comment = await commentService.update(req.params.id, req.body, req.user);
  return ok(res, 'Comment updated successfully', comment);
});

export const destroy = asyncHandler(async (req, res) => {
  await commentService.remove(req.params.id, req.user);
  return ok(res, 'Comment deleted successfully', null);
});

export default { index, indexByProduct, store, update, destroy };
