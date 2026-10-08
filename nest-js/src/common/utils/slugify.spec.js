const { slugify, uniqueSlug } = require('./slugify');

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('Kafé Mouse Pro')).toBe('kafe-mouse-pro');
    expect(slugify('  Smartphone   Aurora 5G  ')).toBe('smartphone-aurora-5g');
    expect(slugify('Electronics & Accessories')).toBe('electronics-accessories');
  });

  it('never returns an empty slug (returns empty string for all-special input)', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    await expect(uniqueSlug('Laptop Vertex', async () => false)).resolves.toBe('laptop-vertex');
  });

  it('appends an incrementing suffix for every collision', async () => {
    const taken = new Set(['laptop-vertex', 'laptop-vertex-2', 'laptop-vertex-3']);
    const isTaken = async (slug) => taken.has(slug);

    await expect(uniqueSlug('Laptop Vertex', isTaken)).resolves.toBe('laptop-vertex-4');
  });

  it('falls back to "item" when the source has no usable characters', async () => {
    await expect(uniqueSlug('###', async () => false)).resolves.toBe('item');
  });
});
