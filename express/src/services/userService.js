import { Op } from 'sequelize';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { findByIdOrFail, buildWhereFromQuery, paginateQuery } from './serviceHelpers.js';

const SORTABLE = ['id', 'name', 'email', 'role', 'created_at', 'updated_at'];

export async function list(query) {
  const where = buildWhereFromQuery(query, { searchable: ['name', 'email'] });
  if (query.role !== undefined && query.role !== '') {
    where.role = query.role;
  }
  return paginateQuery(User, { query, where, sortable: SORTABLE });
}

export async function getById(id) {
  return findByIdOrFail(User, id, { label: 'User' });
}

export async function getProfile(userId) {
  return findByIdOrFail(User, userId, { label: 'User' });
}

export async function create(payload) {
  const { name, email, password, role = 'user' } = payload;

  const existing = await User.unscoped().findOne({ where: { email }, attributes: ['id'] });
  if (existing) {
    throw ApiError.unprocessable('Validation failed', { email: ['The email has already been taken.'] });
  }

  return User.create({ name, email, password, role });
}

export async function update(id, payload) {
  const user = await findByIdOrFail(User, id, { label: 'User' });

  const { name, email, password, role } = payload;

  if (email !== undefined && email !== null && email !== user.email) {
    const existing = await User.unscoped().findOne({
      where: { email, id: { [Op.ne]: user.id } },
      attributes: ['id'],
    });
    if (existing) {
      throw ApiError.unprocessable('Validation failed', { email: ['The email has already been taken.'] });
    }
    user.email = email;
  }

  if (name !== undefined && name !== null) user.name = name;
  if (password !== undefined && password !== null) user.password = password;
  if (role !== undefined && role !== null) user.role = role;

  await user.save();
  return user;
}

export async function updateProfile(id, payload) {
  const user = await findByIdOrFail(User, id, { label: 'User' });
  const { name, email, password } = payload;

  if (name !== undefined && name !== null) user.name = name;
  if (email !== undefined && email !== null && email !== user.email) {
    const existing = await User.unscoped().findOne({
      where: { email, id: { [Op.ne]: user.id } },
      attributes: ['id'],
    });
    if (existing) {
      throw ApiError.unprocessable('Validation failed', { email: ['The email has already been taken.'] });
    }
    user.email = email;
  }
  if (password !== undefined && password !== null) user.password = password;

  await user.save();
  return user;
}

export async function remove(id) {
  const user = await findByIdOrFail(User, id, { label: 'User' });
  await user.destroy();
  return true;
}

export default { list, getById, getProfile, create, update, updateProfile, remove };
