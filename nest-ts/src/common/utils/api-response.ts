/**
 * Canonical response envelope shared by every endpoint of the API contract.
 *
 * success  : { success: true, message, data, meta? }
 * paginated: { success: true, message, data: T[], meta: { page, limit, total, total_pages } }
 * error    : { success: false, message, errors? }
 */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Return type of every `findAll` in a service. The global TransformInterceptor
 * turns it into `{ data: items, meta }`, services never build the envelope.
 */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly total: number,
    public readonly page: number,
    public readonly limit: number,
  ) {}
}

export function isPaginated(value: unknown): value is Paginated<unknown> {
  if (value instanceof Paginated) {
    return true;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { items?: unknown; total?: unknown; page?: unknown; limit?: unknown };

  return (
    Array.isArray(candidate.items) &&
    typeof candidate.total === 'number' &&
    typeof candidate.page === 'number' &&
    typeof candidate.limit === 'number'
  );
}

export function toPageMeta(page: number, limit: number, total: number): PageMeta {
  return {
    page,
    limit,
    total,
    total_pages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
