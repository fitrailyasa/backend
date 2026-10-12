package com.backend.starter.security;

import com.backend.starter.config.AppProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the sliding-window store behind the login limiter (spec sections 1.1 / 1.2).
 */
class LoginAttemptServiceTest {

    @Test
    void locksAtMaxFailuresAndReportsRetryAfterAtLeastOne() {
        LoginAttemptService service = service(3, 900_000L, 10, 900_000L);

        assertThat(service.check("a@x.com", "10.0.0.1")).isZero();

        service.recordFailure("a@x.com", "10.0.0.1");
        service.recordFailure("a@x.com", "10.0.0.1");
        service.recordFailure("a@x.com", "10.0.0.1");

        long retryAfter = service.check("a@x.com", "10.0.0.1");
        assertThat(retryAfter).isGreaterThanOrEqualTo(1L);
        // A different email from the same IP is untouched (IP counter below its max).
        assertThat(service.check("b@x.com", "10.0.0.1")).isZero();

        service.resetForEmail("a@x.com");
        assertThat(service.check("a@x.com", "10.0.0.1")).isZero();
    }

    @Test
    void windowIsSlidingAndExpires() throws Exception {
        LoginAttemptService service = service(2, 120L, 100, 120L);

        service.recordFailure("a@x.com", "10.0.0.2");
        service.recordFailure("a@x.com", "10.0.0.2");
        assertThat(service.check("a@x.com", "10.0.0.2")).isGreaterThanOrEqualTo(1L);

        Thread.sleep(200L);
        assertThat(service.check("a@x.com", "10.0.0.2")).isZero();
    }

    @Test
    void emailKeyIsNormalized() {
        LoginAttemptService service = service(1, 900_000L, 100, 900_000L);

        service.recordFailure("  Admin@X.com ", "10.0.0.3");

        assertThat(service.check("admin@x.com", "10.0.0.3")).isGreaterThanOrEqualTo(1L);
        assertThat(service.check("ADMIN@X.COM", "10.0.0.3")).isGreaterThanOrEqualTo(1L);
        assertThat(service.check("other@x.com", "10.0.0.3")).isZero();
    }

    @Test
    void ipCounterLocksAcrossDifferentEmails() {
        LoginAttemptService service = service(3, 900_000L, 2, 900_000L);

        service.recordFailure("one@x.com", "10.0.0.4");
        service.recordFailure("two@x.com", "10.0.0.4");

        assertThat(service.check("fresh@x.com", "10.0.0.4")).isGreaterThanOrEqualTo(1L);
        // Another client IP is unaffected.
        assertThat(service.check("fresh@x.com", "10.0.0.5")).isZero();
    }

    @Test
    void resetLoginRateLimitsClearsEverything() {
        LoginAttemptService service = service(1, 900_000L, 1, 900_000L);

        service.recordFailure("a@x.com", "10.0.0.6");
        assertThat(service.check("a@x.com", "10.0.0.6")).isGreaterThanOrEqualTo(1L);

        service.resetLoginRateLimits();

        assertThat(service.check("a@x.com", "10.0.0.6")).isZero();
    }

    @Test
    void zeroMaxDisablesTheLimiter() {
        LoginAttemptService service = service(0, 900_000L, 0, 900_000L);

        service.recordFailure("a@x.com", "10.0.0.7");
        service.recordFailure("a@x.com", "10.0.0.7");

        assertThat(service.check("a@x.com", "10.0.0.7")).isZero();
    }

    private static LoginAttemptService service(int emailMax, long emailWindowMs, int ipMax, long ipWindowMs) {
        AppProperties properties = new AppProperties();
        properties.getLoginRateLimit().setMax(emailMax);
        properties.getLoginRateLimit().setWindowMs(emailWindowMs);
        properties.getLoginRateLimit().setIpMax(ipMax);
        properties.getLoginRateLimit().setIpWindowMs(ipWindowMs);
        return new LoginAttemptService(properties);
    }
}
