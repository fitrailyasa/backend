package com.backend.starter.common;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public final class DotenvLoader {

    private DotenvLoader() {
    }

    public static void load() {
        Path path = Path.of(".env");
        if (!Files.isRegularFile(path)) {
            return;
        }
        List<String> lines;
        try {
            lines = Files.readAllLines(path);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read .env", exception);
        }
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            int separator = trimmed.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = trimmed.substring(0, separator).trim();
            String value = stripQuotes(trimmed.substring(separator + 1).trim());
            if (key.isEmpty() || System.getenv(key) != null || System.getProperty(key) != null) {
                continue;
            }
            System.setProperty(key, value);
        }
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2) {
            char first = value.charAt(0);
            char last = value.charAt(value.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }
}
