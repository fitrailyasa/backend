import { Paginated, isPaginated, toPageMeta } from './api-response';

describe('Paginated', () => {
  it('carries the page window together with the fetched rows', () => {
    const page = new Paginated([{ id: 1 }], 57, 2, 10);

    expect(page.items).toEqual([{ id: 1 }]);
    expect(page.total).toBe(57);
    expect(page.page).toBe(2);
    expect(page.limit).toBe(10);
  });
});

describe('isPaginated', () => {
  it('recognises a Paginated instance', () => {
    expect(isPaginated(new Paginated([], 0, 1, 10))).toBe(true);
  });

  it('recognises the plain object produced by class serialisation', () => {
    expect(isPaginated({ items: [], total: 3, page: 1, limit: 10 })).toBe(true);
  });

  it('rejects ordinary payloads', () => {
    expect(isPaginated(null)).toBe(false);
    expect(isPaginated(undefined)).toBe(false);
    expect(isPaginated([{ id: 1 }])).toBe(false);
    expect(isPaginated({ data: [], message: 'ok' })).toBe(false);
    expect(isPaginated({ id: 1, items: [{ id: 1 }], total: 200, status: 'pending' })).toBe(false);
    expect(isPaginated('string')).toBe(false);
  });
});

describe('toPageMeta', () => {
  it('rounds total_pages up for a partial last page', () => {
    expect(toPageMeta(1, 10, 57)).toEqual({ page: 1, limit: 10, total: 57, total_pages: 6 });
    expect(toPageMeta(6, 10, 57)).toEqual({ page: 6, limit: 10, total: 57, total_pages: 6 });
  });

  it('returns zero pages for an empty collection', () => {
    expect(toPageMeta(1, 10, 0)).toEqual({ page: 1, limit: 10, total: 0, total_pages: 0 });
  });
});
