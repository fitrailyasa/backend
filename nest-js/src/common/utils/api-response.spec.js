const { ok, paginated } = require('./api-response');

describe('ok', () => {
  it('wraps a single resource with its message', () => {
    expect(ok({ id: 1, name: 'Laptop' }, 'Product retrieved')).toEqual({
      data: { id: 1, name: 'Laptop' },
      message: 'Product retrieved',
    });
  });

  it('keeps null payloads instead of dropping them', () => {
    expect(ok(null, 'User deleted')).toEqual({ data: null, message: 'User deleted' });
  });
});

describe('paginated', () => {
  const pagination = { page: 2, limit: 10 };

  it('adds the meta block expected by the API contract', () => {
    const result = paginated([{ id: 1 }], 57, pagination, 'Products retrieved');

    expect(result.message).toBe('Products retrieved');
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 57, total_pages: 6 });
  });

  it('rounds total_pages up for a partial last page', () => {
    expect(paginated([], 1, { page: 1, limit: 10 }, 'Users retrieved').meta.total_pages).toBe(1);
    expect(paginated([], 0, { page: 1, limit: 10 }, 'Users retrieved').meta.total_pages).toBe(0);
  });
});
