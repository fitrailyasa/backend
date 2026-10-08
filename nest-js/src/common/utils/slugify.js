/**
 * Turns a human readable string into a URL friendly slug.
 */
const slugify = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Builds a slug that `isTaken` reports as free, appending -2, -3, ... when needed.
 * The predicate may be asynchronous.
 */
const uniqueSlug = async (value, isTaken) => {
  const base = slugify(value) || 'item';
  let candidate = base;
  let suffix = 1;

  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
};

module.exports = { slugify, uniqueSlug };
