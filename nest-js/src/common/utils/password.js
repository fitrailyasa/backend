const bcrypt = require('bcrypt');

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Fixed hash compared against when the submitted email does not exist, so a
 * missing account spends the same bcrypt time as a wrong password and
 * response timing cannot reveal whether an email is registered.
 */
const DUMMY_PASSWORD_HASH = '$2b$10$e9o6JKVSSdzoyq6mXzb/ROAyyRvhpI2poZl804/5/F12Lrrp8MTQy';

/** Hashes a plain password with bcrypt. `rounds` defaults to the configured cost. */
const hashPassword = (plain, rounds = BCRYPT_SALT_ROUNDS) => bcrypt.hash(plain, rounds);

/**
 * Constant time comparison of a plain password against a stored bcrypt hash.
 * A leading `bcrypt$` is the prefix another framework in this repo writes.
 */
const verifyPassword = (plain, hash) => {
  const stored = typeof hash === 'string' && hash.startsWith('bcrypt$') ? hash.slice('bcrypt$'.length) : hash;
  return bcrypt.compare(plain, stored);
};

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  BCRYPT_SALT_ROUNDS,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
};
