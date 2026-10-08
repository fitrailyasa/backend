package com.backend.starter.common;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Checks {

    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");

    private Checks() {
    }

    public static String requiredText(FieldErrors errors, String field, String value, int min, int max, String label) {
        if (value == null || value.trim().isEmpty()) {
            errors.add(field, label + " is required.");
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() < min || trimmed.length() > max) {
            errors.add(field, label + " must be between " + min + " and " + max + " characters.");
            return null;
        }
        return trimmed;
    }

    public static String optionalText(FieldErrors errors, String field, String value, int min, int max, String label) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() < min || trimmed.length() > max) {
            errors.add(field, label + " must be between " + min + " and " + max + " characters.");
            return null;
        }
        return trimmed;
    }

    public static String requiredEmail(FieldErrors errors, String value) {
        if (value == null || value.trim().isEmpty()) {
            errors.add("email", "Email is required.");
            return null;
        }
        return email(errors, value);
    }

    public static String optionalEmail(FieldErrors errors, String value) {
        if (value == null) {
            return null;
        }
        if (value.trim().isEmpty()) {
            errors.add("email", "The email must be a valid email address.");
            return null;
        }
        return email(errors, value);
    }

    private static String email(FieldErrors errors, String value) {
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        if (trimmed.length() < 3 || trimmed.length() > 150) {
            errors.add("email", "Email must be between 3 and 150 characters.");
            return null;
        }
        if (!EMAIL.matcher(trimmed).matches()) {
            errors.add("email", "The email must be a valid email address.");
            return null;
        }
        return trimmed;
    }

    public static String requiredPassword(FieldErrors errors, String value) {
        if (value == null || value.isEmpty()) {
            errors.add("password", "Password is required.");
            return null;
        }
        return password(errors, value);
    }

    public static String optionalPassword(FieldErrors errors, String value) {
        if (value == null) {
            return null;
        }
        if (value.isEmpty()) {
            errors.add("password", "Password is required.");
            return null;
        }
        return password(errors, value);
    }

    private static String password(FieldErrors errors, String value) {
        if (value.length() < 8 || value.length() > 72) {
            errors.add("password", "Password must be at least 8 characters long.");
            return null;
        }
        return value;
    }

    public static void confirmation(FieldErrors errors, String password, String confirmation, boolean required) {
        if (password == null) {
            if (confirmation != null && !confirmation.isEmpty()) {
                errors.add("password_confirmation", "Password is required when password_confirmation is provided.");
            }
            return;
        }
        if (confirmation == null || confirmation.isEmpty()) {
            if (required) {
                errors.add("password_confirmation", "password_confirmation is required.");
            }
            return;
        }
        if (!confirmation.equals(password)) {
            errors.add("password_confirmation", "password_confirmation must match password.");
        }
    }

    public static String optionalSlug(FieldErrors errors, String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > max) {
            errors.add("slug", "Slug must be between 1 and " + max + " characters.");
            return null;
        }
        if (!SLUG.matcher(trimmed).matches()) {
            errors.add("slug", "Slug may only contain lowercase letters, numbers and single hyphens.");
            return null;
        }
        return trimmed;
    }

    public static BigDecimal requiredPrice(FieldErrors errors, BigDecimal value) {
        if (value == null) {
            errors.add("price", "Price is required.");
            return null;
        }
        if (value.signum() < 0) {
            errors.add("price", "Price must be a number greater than or equal to 0.");
            return null;
        }
        return value;
    }

    public static BigDecimal optionalPrice(FieldErrors errors, BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (value.signum() < 0) {
            errors.add("price", "Price must be a number greater than or equal to 0.");
            return null;
        }
        return value;
    }

    public static Integer optionalStock(FieldErrors errors, Integer value) {
        if (value == null) {
            return null;
        }
        if (value < 0) {
            errors.add("stock", "Stock must be an integer greater than or equal to 0.");
            return null;
        }
        return value;
    }

    public static Long requiredCategoryId(FieldErrors errors, Long value) {
        if (value == null || value < 1) {
            errors.add("category_id", value == null ? "category_id is required." : "category_id must be a positive integer.");
            return null;
        }
        return value;
    }

    public static Long optionalCategoryId(FieldErrors errors, Long value) {
        if (value == null) {
            return null;
        }
        if (value < 1) {
            errors.add("category_id", "category_id must be a positive integer.");
            return null;
        }
        return value;
    }

    public static List<Long> optionalTagIds(FieldErrors errors, List<Long> tags) {
        if (tags == null) {
            return null;
        }
        if (tags.size() > 20) {
            errors.add("tags", "tags must be an array of tag ids.");
            return null;
        }
        for (Long tag : tags) {
            if (tag == null || tag < 1) {
                errors.add("tags", "tags must be an array of positive integers.");
                return null;
            }
        }
        return tags;
    }

    public static String role(FieldErrors errors, String value, boolean required) {
        if (value == null || value.isBlank()) {
            if (required) {
                errors.add("role", "Role is required.");
            }
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("user") && !normalized.equals("admin")) {
            errors.add("role", "Role must be one of: user, admin.");
            return null;
        }
        return normalized;
    }
}
