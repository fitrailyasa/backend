package com.backend.starter.common;

import java.text.Normalizer;
import java.util.Locale;

public final class Slugify {

    private Slugify() {
    }

    public static String of(String value, int maxLength) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .trim()
                .replaceAll("['\"`]", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "")
                .replaceAll("-{2,}", "-");
        if (normalized.length() > maxLength) {
            normalized = normalized.substring(0, maxLength).replaceAll("-+$", "");
        }
        return normalized.isEmpty() ? "item" : normalized;
    }
}
