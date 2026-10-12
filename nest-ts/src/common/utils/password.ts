import * as bcrypt from 'bcrypt';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const BCRYPT_SALT_ROUNDS = 10;

/**
 * Fixed hash compared against when the email does not exist, so a failed login
 * spends the same bcrypt work whether or not the account is real.
 */
export const DUMMY_PASSWORD_HASH = '$2b$10$e9o6JKVSSdzoyq6mXzb/ROAyyRvhpI2poZl804/5/F12Lrrp8MTQy';

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
