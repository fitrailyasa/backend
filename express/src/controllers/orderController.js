import * as orderService from '../services/orderService.js';
import ApiError from '../utils/ApiError.js';
import { created, ok, paginated } from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  if (req.query.user_id !== undefined && req.query.user_id !== '' && req.user.role !== 'admin') {
    throw ApiError.forbidden('The user_id filter is only available to administrators');
  }

  const { rows, meta } = await orderService.list(req.query, req.user);
  return paginated(res, 'Orders retrieved', rows, meta);
});

export const show = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id, req.user, req.query);
  return ok(res, 'Order retrieved', order);
});

export const store = asyncHandler(async (req, res) => {
  const order = await orderService.create(req.body, req.user);
  return created(res, 'Order created successfully', order);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateStatus(req.params.id, req.body.status, req.user);
  return ok(res, 'Order status updated successfully', order);
});

export const destroy = asyncHandler(async (req, res) => {
  await orderService.remove(req.params.id, req.user);
  return ok(res, 'Order deleted successfully', null);
});

export default { index, show, store, updateStatus, destroy };
