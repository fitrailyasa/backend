import * as categoryService from '../services/categoryService.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const { rows, meta } = await categoryService.list(req.query);
  return paginated(res, 'Categories retrieved', rows, meta);
});

export const show = asyncHandler(async (req, res) => {
  const category = await categoryService.getById(req.params.id, req.query);
  return ok(res, 'Category retrieved', category);
});

export const store = asyncHandler(async (req, res) => {
  const category = await categoryService.create(req.body);
  return created(res, 'Category created successfully', category);
});

export const update = asyncHandler(async (req, res) => {
  const category = await categoryService.update(req.params.id, req.body);
  return ok(res, 'Category updated successfully', category);
});

export const destroy = asyncHandler(async (req, res) => {
  await categoryService.remove(req.params.id);
  return ok(res, 'Category deleted successfully', null);
});

export default { index, show, store, update, destroy };
