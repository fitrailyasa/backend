package com.backend.starter.common;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PageMeta(
        int page,
        int limit,
        long total,
        @JsonProperty("total_pages") int totalPages
) {
    public static PageMeta of(int page, int limit, long total) {
        int pages = limit <= 0 ? 0 : (int) Math.ceil(total / (double) limit);
        return new PageMeta(page, limit, total, pages);
    }
}
