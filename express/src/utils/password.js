import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const ROUNDS = env.bcryptRounds;

// Fixed hash of a throwaway string, compared against when the email does not
// exist so the response time does not reveal whether an account exists.
export const DUMMY_PASSWORD_HASH = '$2b$10$IyIMPx2KGclX1VEKWvHp/u7MWLg.ou6un7kRDMoEZn0764QJcaM7W';

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
