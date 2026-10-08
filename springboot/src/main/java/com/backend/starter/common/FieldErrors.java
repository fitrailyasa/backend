package com.backend.starter.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FieldErrors {

    private final Map<String, List<String>> errors = new LinkedHashMap<>();

    public void add(String field, String message) {
        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    public boolean has(String field) {
        return errors.containsKey(field);
    }

    public boolean isEmpty() {
        return errors.isEmpty();
    }

    public Map<String, List<String>> toMap() {
        return errors;
    }

    public void throwIfAny() {
        if (!errors.isEmpty()) {
            throw ApiException.unprocessable(errors);
        }
    }
}
