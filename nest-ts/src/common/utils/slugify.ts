export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a unique slug from a human readable string. When the base slug is
 * already taken it appends `-2`, `-3`, ... and never exceeds `maxLength`.
 */
export async function buildUniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxLength = 120,
): Promise<string> {
  const base = slugify(source) || 'item';
  let candidate = base;
  let counter = 2;

  while (await isTaken(candidate)) {
    const suffix = `-${counter}`;
    candidate = `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
    counter += 1;
  }

  return candidate;
}
