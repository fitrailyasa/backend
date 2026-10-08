const { Transform } = require('class-transformer');

/** Trims surrounding whitespace on incoming strings. */
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and lowercases a value, used for e-mail addresses. */
const LowerCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

module.exports = { Trim, LowerCase };
