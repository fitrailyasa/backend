package com.backend.starter.security;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class TokenBlacklist {

    private final Map<String, Long> entries = new ConcurrentHashMap<>();

    public void blacklist(String jti, long expiresAtEpochSecond) {
        if (jti == null || jti.isBlank()) {
            return;
        }
        long expiresAtMillis = expiresAtEpochSecond * 1000L;
        if (expiresAtMillis <= System.currentTimeMillis()) {
            return;
        }
        entries.put(jti, expiresAtMillis);
        if (entries.size() > 1000) {
            long now = System.currentTimeMillis();
            entries.entrySet().removeIf(entry -> entry.getValue() <= now);
        }
    }

    public boolean isBlacklisted(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        Long expiresAt = entries.get(jti);
        if (expiresAt == null) {
            return false;
        }
        if (expiresAt <= System.currentTimeMillis()) {
            entries.remove(jti);
            return false;
        }
        return true;
    }
}
