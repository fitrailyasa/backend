import { Transform } from 'class-transformer';

/** Trims surrounding whitespace on incoming strings. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trims and lowercases a value, used for e-mail addresses. */
export const LowerCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
