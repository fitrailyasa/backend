/**
 * Response envelope helpers handed to the TransformInterceptor.
 *
 * Success  : { success: true, message, data }
 * Paginated: { success: true, message, data, meta: { page, limit, total, total_pages } }
 */

/** Single resource envelope. */
const ok = (data, message) => ({ data, message });

/** Paginated collection envelope, `pagination` comes from `buildPagination`. */
const paginated = (data, total, pagination, message) => ({
  data,
  message,
  meta: {
    page: pagination.page,
    limit: pagination.limit,
    total,
    total_pages: Math.ceil(total / pagination.limit),
  },
});

module.exports = { ok, paginated };
