import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const ROUNDS = env.bcryptRounds;

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (typeof hash !== 'string' || hash.length === 0) return false;
  const stored = hash.startsWith('bcrypt$') ? hash.slice('bcrypt$'.length) : hash;
  return bcrypt.compare(String(plain), stored);
}

export async function comparePassword(plain, hash) {
  return verifyPassword(plain, hash);
}

export default { hashPassword, verifyPassword, comparePassword };
