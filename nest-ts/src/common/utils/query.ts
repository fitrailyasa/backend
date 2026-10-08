import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Escapes the characters that are special inside a MySQL LIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** `%term%` used by every `?search=` implementation. */
export function searchPattern(value: string): string {
  return `%${escapeLike(value.trim())}%`;
}

/** `?include=a,b` -> `['a', 'b']`, silently dropping anything not allowed. */
export function parseInclude(value: string | undefined, allowed: readonly string[]): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is string => allowed.includes(part));
}

/**
 * Applies `?sort=&order=` while only ever allowing whitelisted columns, so a
 * client can never inject an arbitrary expression into the ORDER BY clause.
 */
export function applySorting<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  sortable: Readonly<Record<string, string>>,
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
  fallback: string,
): SelectQueryBuilder<T> {
  let column = sort ? sortable[sort] : sortable[fallback];

  if (!column) {
    column = sortable[fallback];
  }

  return qb.orderBy(`${alias}.${column}`, order === 'asc' ? 'ASC' : 'DESC');
}
