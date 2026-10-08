import { SelectQueryBuilder } from 'typeorm';
import { applySorting, escapeLike, parseInclude, searchPattern } from './query';

describe('escapeLike', () => {
  it('escapes the LIKE wildcards so a search cannot match everything', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
  });
});

describe('searchPattern', () => {
  it('wraps the term in wildcards and trims it', () => {
    expect(searchPattern('  laptop  ')).toBe('%laptop%');
  });

  it('escapes wildcards inside the term', () => {
    expect(searchPattern('50% off')).toBe('%50\\% off%');
  });
});

describe('parseInclude', () => {
  it('splits, trims and filters unknown values', () => {
    expect(parseInclude('items, user ,hacker', ['items', 'user'])).toEqual(['items', 'user']);
  });

  it('returns an empty list when nothing was requested', () => {
    expect(parseInclude(undefined, ['items'])).toEqual([]);
    expect(parseInclude('', ['items'])).toEqual([]);
  });
});

describe('applySorting', () => {
  const sortable = { id: 'id', created_at: 'createdAt' } as const;

  const fakeQb = (): SelectQueryBuilder<Record<string, unknown>> =>
    ({ orderBy: jest.fn() }) as unknown as SelectQueryBuilder<Record<string, unknown>>;

  it('sorts by the requested column', () => {
    const qb = fakeQb();

    applySorting(qb, 'product', sortable, 'created_at', 'asc', 'id');

    expect(qb.orderBy).toHaveBeenCalledWith('product.createdAt', 'ASC');
  });

  it('falls back to the default column when the request is missing', () => {
    const qb = fakeQb();

    applySorting(qb, 'product', sortable, undefined, undefined, 'created_at');

    expect(qb.orderBy).toHaveBeenCalledWith('product.createdAt', 'DESC');
  });

  it('ignores columns that are not whitelisted', () => {
    const qb = fakeQb();

    applySorting(qb, 'product', sortable, 'name); DROP TABLE users; --', 'asc', 'id');

    expect(qb.orderBy).toHaveBeenCalledWith('product.id', 'ASC');
  });
});
