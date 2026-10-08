import { buildUniqueSlug, slugify } from './slugify';

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('Kafé Mouse Pro')).toBe('kafe-mouse-pro');
    expect(slugify('  Smartphone   Aurora 5G  ')).toBe('smartphone-aurora-5g');
    expect(slugify('Electronics & Accessories')).toBe('electronics-accessories');
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('buildUniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    await expect(buildUniqueSlug('Laptop Vertex', async () => false)).resolves.toBe('laptop-vertex');
  });

  it('appends an incrementing suffix for every collision', async () => {
    const taken = new Set(['laptop-vertex', 'laptop-vertex-2', 'laptop-vertex-3']);
    const isTaken = async (slug: string) => taken.has(slug);

    await expect(buildUniqueSlug('Laptop Vertex', isTaken)).resolves.toBe('laptop-vertex-4');
  });

  it('falls back to "item" when the source has no usable characters', async () => {
    await expect(buildUniqueSlug('###', async () => false)).resolves.toBe('item');
  });

  it('keeps the generated slug within maxLength', async () => {
    const slug = await buildUniqueSlug('A'.repeat(200), async () => false);

    expect(slug).toHaveLength(200);
  });
});
