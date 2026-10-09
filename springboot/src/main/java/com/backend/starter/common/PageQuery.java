package com.backend.starter.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class PageQuery {

    private final int page;
    private final int limit;
    private final String sortProperty;
    private final Sort.Direction direction;
    private final String search;
    private final Set<String> include;

    private PageQuery(int page, int limit, String sortProperty, Sort.Direction direction, String search, Set<String> include) {
        this.page = page;
        this.limit = limit;
        this.sortProperty = sortProperty;
        this.direction = direction;
        this.search = search;
        this.include = include;
    }

    public int page() {
        return page;
    }

    public int limit() {
        return limit;
    }

    public String search() {
        return search;
    }

    public boolean includes(String value) {
        return include.contains(value);
    }

    public PageRequest pageable() {
        return PageRequest.of(page - 1, limit, Sort.by(direction, sortProperty));
    }

    public static PageQuery parse(Map<String, String> params, Map<String, String> sortable, List<String> allowedInclude) {
        FieldErrors errors = new FieldErrors();
        int page = positiveInt(errors, "page", params.get("page"), 1, 100000, "Page must be a positive integer.");
        int limit = positiveInt(errors, "limit", params.get("limit"), 10, 100, "Limit must be an integer between 1 and 100.");
        String search = blankToNull(params.get("search"));
        if (search != null && search.length() > 150) {
            errors.add("search", "Search must be at most 150 characters.");
            search = null;
        }
        String rawSort = blankToNull(params.get("sort"));
        String sortProperty = sortable.getOrDefault("id", sortable.values().iterator().next());
        if (rawSort != null) {
            String mapped = sortable.get(rawSort);
            if (mapped != null) {
                sortProperty = mapped;
            } else {
                errors.add("sort", "Sort must be one of: " + String.join(", ", sortable.keySet()) + ".");
            }
        }
        String rawOrder = blankToNull(params.get("order"));
        Sort.Direction direction = Sort.Direction.DESC;
        if (rawOrder != null) {
            String normalized = rawOrder.toLowerCase(Locale.ROOT);
            if ("asc".equals(normalized)) {
                direction = Sort.Direction.ASC;
            } else if ("desc".equals(normalized)) {
                direction = Sort.Direction.DESC;
            } else {
                errors.add("order", "Order must be either asc or desc.");
            }
        }
        Set<String> include = new LinkedHashSet<>();
        String rawInclude = blankToNull(params.get("include"));
        if (rawInclude != null) {
            List<String> invalid = new ArrayList<>();
            for (String part : rawInclude.split(",")) {
                String entry = part.trim();
                if (entry.isEmpty()) {
                    continue;
                }
                if (allowedInclude.contains(entry)) {
                    include.add(entry);
                } else {
                    invalid.add(entry);
                }
            }
            if (!invalid.isEmpty()) {
                errors.add("include", "Unsupported include value(s): " + String.join(", ", invalid)
                        + ". Allowed: " + String.join(", ", allowedInclude) + ".");
            }
        }
        errors.throwIfAny();
        return new PageQuery(page, limit, sortProperty, direction, search, include);
    }

    public static Map<String, String> fromRequest(jakarta.servlet.http.HttpServletRequest request) {
        Map<String, String> map = new LinkedHashMap<>();
        request.getParameterMap().forEach((key, values) -> {
            if (values != null && values.length > 0 && values[0] != null) {
                map.put(key, values[0]);
            }
        });
        return map;
    }

    public static Long optionalPositiveLong(FieldErrors errors, String field, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        if (!raw.matches("^[1-9]\\d*$")) {
            errors.add(field, field + " must be a positive integer.");
            return null;
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException exception) {
            errors.add(field, field + " must be a positive integer.");
            return null;
        }
    }

    public static BigDecimal optionalNonNegativeDecimal(FieldErrors errors, String field, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(raw.trim());
            if (value.signum() < 0) {
                errors.add(field, field + " must be a number greater than or equal to 0.");
                return null;
            }
            return value;
        } catch (NumberFormatException exception) {
            errors.add(field, field + " must be a number greater than or equal to 0.");
            return null;
        }
    }

    public static long requiredPathId(String name, String raw) {
        if (raw == null || !raw.matches("^[1-9]\\d*$")) {
            throw ApiException.unprocessable(Map.of(name, List.of(name + " must be a positive integer.")));
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException exception) {
            throw ApiException.unprocessable(Map.of(name, List.of(name + " must be a positive integer.")));
        }
    }

    private static int positiveInt(FieldErrors errors, String field, String raw, int fallback, int max, String message) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        if (!raw.matches("^[1-9]\\d*$")) {
            errors.add(field, message);
            return fallback;
        }
        try {
            int value = Integer.parseInt(raw);
            if (value < 1 || value > max) {
                errors.add(field, message);
                return fallback;
            }
            return value;
        } catch (NumberFormatException exception) {
            errors.add(field, message);
            return fallback;
        }
    }

    public static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
