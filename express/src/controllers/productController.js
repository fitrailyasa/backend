import * as productService from '../services/productService.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const { rows, meta } = await productService.list(req.query);
  return paginated(res, 'Products retrieved', rows, meta);
});

export const show = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.id, req.query);
  return ok(res, 'Product retrieved', product);
});

export const store = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body);
  return created(res, 'Product created successfully', product);
});

export const update = asyncHandler(async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  return ok(res, 'Product updated successfully', product);
});

export const destroy = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id);
  return ok(res, 'Product deleted successfully', null);
});

export default { index, show, store, update, destroy };
