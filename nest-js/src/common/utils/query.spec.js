const { buildPagination, escapeLike, parseIncludes, resolveSortColumn, searchPattern } = require('./query');

describe('buildPagination', () => {
  it('returns defaults when no query params are provided', () => {
    const result = buildPagination({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(10);
    expect(result.order).toBe('DESC');
  });

  it('parses page and limit from the query string', () => {
    const result = buildPagination({ page: '2', limit: '25' });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
    expect(result.skip).toBe(25);
    expect(result.take).toBe(25);
  });

  it('caps limit at MAX_LIMIT (100)', () => {
    expect(buildPagination({ limit: '999' }).limit).toBe(100);
  });

  it('parses search and trims whitespace', () => {
    expect(buildPagination({ search: '  laptop  ' }).search).toBe('laptop');
  });

  it('normalises order to ASC or DESC', () => {
    expect(buildPagination({ order: 'asc' }).order).toBe('ASC');
    expect(buildPagination({ order: 'ASC' }).order).toBe('ASC');
    expect(buildPagination({ order: 'desc' }).order).toBe('DESC');
    expect(buildPagination({}).order).toBe('DESC');
  });

  it('ignores non-positive page / limit values and falls back to defaults', () => {
    const result = buildPagination({ page: '-1', limit: '0' });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('honours the per resource default and max limit', () => {
    const result = buildPagination({ limit: '500' }, { defaultLimit: 20, maxLimit: 50 });

    expect(result.limit).toBe(50);
    expect(buildPagination({}, { defaultLimit: 20 }).limit).toBe(20);
  });
});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards so a search cannot match everything', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves an ordinary term untouched', () => {
    expect(escapeLike('laptop')).toBe('laptop');
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

describe('parseIncludes', () => {
  it('splits, trims and filters unknown values', () => {
    expect(parseIncludes('items, user ,hacker', ['items', 'user'])).toEqual(['items', 'user']);
  });

  it('returns an empty list when nothing was requested', () => {
    expect(parseIncludes(undefined, ['items'])).toEqual([]);
    expect(parseIncludes('', ['items'])).toEqual([]);
  });
});

describe('resolveSortColumn', () => {
  const sortable = ['id', 'name', 'created_at', 'price'];

  it('returns the mapped property for a whitelisted sort key', () => {
    expect(resolveSortColumn('created_at', sortable)).toBe('createdAt');
    expect(resolveSortColumn('price', sortable)).toBe('price');
  });

  it('falls back to the default column when the key is missing or not whitelisted', () => {
    expect(resolveSortColumn(undefined, sortable, 'id')).toBe('id');
    expect(resolveSortColumn('hacker; DROP TABLE', sortable, 'id')).toBe('id');
  });
});
