import * as bcrypt from 'bcrypt';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const BCRYPT_SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

/**
 * Constant time comparison of a plain password against a stored bcrypt hash.
 * A leading `bcrypt$` is the prefix another framework in this repo writes.
 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const stored = hash.startsWith('bcrypt$') ? hash.slice('bcrypt$'.length) : hash;
  return bcrypt.compare(plain, stored);
}
