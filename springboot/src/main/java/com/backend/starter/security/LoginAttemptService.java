package com.backend.starter.security;

import com.backend.starter.config.AppProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window limiter for failed logins (see {@code _SECURITY_SPEC.md} section 1).
 *
 * <p>Two in-memory stores: failed attempts per normalized email and per client IP. Entries carry
 * their absolute expiry so expired failures drop out of the window automatically, and whole keys
 * are pruned so the stores cannot grow forever. Counters only move on failed credential checks;
 * a successful login clears that email's counter.</p>
 *
 * <p>Counters are per process: they reset on restart and are not shared between instances.</p>
 */
@Component
public class LoginAttemptService {

    /** Full-store pruning kicks in once a store grows past this many keys. */
    private static final int PRUNE_THRESHOLD = 1000;

    private final AppProperties properties;
    private final Map<String, Deque<Long>> emailExpiries = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> ipExpiries = new ConcurrentHashMap<>();

    public LoginAttemptService(AppProperties properties) {
        this.properties = properties;
    }

    /**
     * Returns {@code 0} when the login may proceed, otherwise the number of seconds (>= 1) to wait
     * until the oldest failure in the blocking window expires.
     */
    public long check(String email, String clientIp) {
        long now = System.currentTimeMillis();
        AppProperties.LoginRateLimit limits = properties.getLoginRateLimit();
        long emailRetry = retryAfter(emailExpiries, normalizeEmail(email), limits.getMax(), now);
        long ipRetry = retryAfter(ipExpiries, normalizeIp(clientIp), limits.getIpMax(), now);
        return Math.max(emailRetry, ipRetry);
    }

    /** Records one failed credential check for the email and for the client IP. */
    public void recordFailure(String email, String clientIp) {
        long now = System.currentTimeMillis();
        AppProperties.LoginRateLimit limits = properties.getLoginRateLimit();
        record(emailExpiries, normalizeEmail(email), limits.getWindowMs(), now);
        record(ipExpiries, normalizeIp(clientIp), limits.getIpWindowMs(), now);
        pruneIdleKeys(now);
    }

    /** A successful login clears that email's counter. */
    public void resetForEmail(String email) {
        emailExpiries.remove(normalizeEmail(email));
    }

    /** Test hook: clears every email and IP counter. */
    public void resetLoginRateLimits() {
        emailExpiries.clear();
        ipExpiries.clear();
    }

    private static long retryAfter(Map<String, Deque<Long>> store, String key, int max, long now) {
        if (max <= 0 || key.isEmpty()) {
            return 0;
        }
        long[] result = new long[1];
        store.compute(key, (ignored, deque) -> {
            if (deque == null) {
                return null;
            }
            prune(deque, now);
            if (deque.isEmpty()) {
                return null;
            }
            if (deque.size() >= max) {
                long oldest = deque.peekFirst();
                result[0] = Math.max(1, (oldest - now + 999) / 1000);
            }
            return deque;
        });
        return result[0];
    }

    private static void record(Map<String, Deque<Long>> store, String key, long windowMs, long now) {
        if (key.isEmpty()) {
            return;
        }
        store.compute(key, (ignored, deque) -> {
            Deque<Long> failures = deque == null ? new ArrayDeque<>() : deque;
            failures.addLast(now + Math.max(1L, windowMs));
            prune(failures, now);
            return failures;
        });
    }

    private static void prune(Deque<Long> deque, long now) {
        while (!deque.isEmpty() && deque.peekFirst() <= now) {
            deque.pollFirst();
        }
    }

    /** Drops keys whose failures have all expired so the stores stay bounded. */
    private void pruneIdleKeys(long now) {
        if (emailExpiries.size() > PRUNE_THRESHOLD) {
            emailExpiries.entrySet().removeIf(entry -> {
                prune(entry.getValue(), now);
                return entry.getValue().isEmpty();
            });
        }
        if (ipExpiries.size() > PRUNE_THRESHOLD) {
            ipExpiries.entrySet().removeIf(entry -> {
                prune(entry.getValue(), now);
                return entry.getValue().isEmpty();
            });
        }
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeIp(String clientIp) {
        return clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
    }
}
