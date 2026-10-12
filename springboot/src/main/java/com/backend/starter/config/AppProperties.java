package com.backend.starter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private boolean seed = false;
    private String corsOrigins = "*";
    private int bcryptRounds = 10;
    private boolean trustProxy = false;
    private boolean enableHsts = false;
    private long bodyLimit = 102_400L;
    private final Jwt jwt = new Jwt();
    private final RateLimit rateLimit = new RateLimit();
    private final AuthRateLimit authRateLimit = new AuthRateLimit();
    private final LoginRateLimit loginRateLimit = new LoginRateLimit();

    public boolean isSeed() {
        return seed;
    }

    public void setSeed(boolean seed) {
        this.seed = seed;
    }

    public String getCorsOrigins() {
        return corsOrigins;
    }

    public void setCorsOrigins(String corsOrigins) {
        this.corsOrigins = corsOrigins;
    }

    public int getBcryptRounds() {
        return bcryptRounds;
    }

    public void setBcryptRounds(int bcryptRounds) {
        this.bcryptRounds = bcryptRounds;
    }

    public boolean isTrustProxy() {
        return trustProxy;
    }

    public void setTrustProxy(boolean trustProxy) {
        this.trustProxy = trustProxy;
    }

    public boolean isEnableHsts() {
        return enableHsts;
    }

    public void setEnableHsts(boolean enableHsts) {
        this.enableHsts = enableHsts;
    }

    public long getBodyLimit() {
        return bodyLimit;
    }

    public void setBodyLimit(long bodyLimit) {
        this.bodyLimit = bodyLimit;
    }

    public Jwt getJwt() {
        return jwt;
    }

    public RateLimit getRateLimit() {
        return rateLimit;
    }

    public AuthRateLimit getAuthRateLimit() {
        return authRateLimit;
    }

    public LoginRateLimit getLoginRateLimit() {
        return loginRateLimit;
    }

    public static class Jwt {
        private String secret = "change-me-to-a-secret-at-least-32-chars";
        private String accessSecret = "";
        private String refreshSecret = "";
        private long expiresIn = 3600;
        private long refreshExpiresIn = 604800;
        private String issuer = "backend-starter";
        private String audience = "backend-starter-clients";

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public String getAccessSecret() {
            return accessSecret;
        }

        public void setAccessSecret(String accessSecret) {
            this.accessSecret = accessSecret;
        }

        public String getRefreshSecret() {
            return refreshSecret;
        }

        public void setRefreshSecret(String refreshSecret) {
            this.refreshSecret = refreshSecret;
        }

        public long getExpiresIn() {
            return expiresIn;
        }

        public void setExpiresIn(long expiresIn) {
            this.expiresIn = expiresIn;
        }

        public long getRefreshExpiresIn() {
            return refreshExpiresIn;
        }

        public void setRefreshExpiresIn(long refreshExpiresIn) {
            this.refreshExpiresIn = refreshExpiresIn;
        }

        public String getIssuer() {
            return issuer;
        }

        public void setIssuer(String issuer) {
            this.issuer = issuer;
        }

        public String getAudience() {
            return audience;
        }

        public void setAudience(String audience) {
            this.audience = audience;
        }

        public String accessKey() {
            return blank(accessSecret) ? secret : accessSecret;
        }

        public String refreshKey() {
            return blank(refreshSecret) ? secret : refreshSecret;
        }

        private static boolean blank(String value) {
            return value == null || value.isBlank();
        }
    }

    /** Global per-IP request limit applied to every route (RATE_LIMIT_*). */
    public static class RateLimit {
        private long windowMs = 60_000L;
        private int max = 300;
        private boolean enabled = true;

        public long getWindowMs() {
            return windowMs;
        }

        public void setWindowMs(long windowMs) {
            this.windowMs = windowMs;
        }

        public int getMax() {
            return max;
        }

        public void setMax(int max) {
            this.max = max;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }

    /** Stricter per-IP limit kept on the auth routes (AUTH_RATE_LIMIT_*). */
    public static class AuthRateLimit {
        private long windowMs = 900_000L;
        private int max = 100;

        public long getWindowMs() {
            return windowMs;
        }

        public void setWindowMs(long windowMs) {
            this.windowMs = windowMs;
        }

        public int getMax() {
            return max;
        }

        public void setMax(int max) {
            this.max = max;
        }
    }

    /** Failed-login limiter: sliding windows over normalized email and client IP (LOGIN_*_RATE_LIMIT_*). */
    public static class LoginRateLimit {
        private int max = 3;
        private long windowMs = 900_000L;
        private int ipMax = 10;
        private long ipWindowMs = 900_000L;

        public int getMax() {
            return max;
        }

        public void setMax(int max) {
            this.max = max;
        }

        public long getWindowMs() {
            return windowMs;
        }

        public void setWindowMs(long windowMs) {
            this.windowMs = windowMs;
        }

        public int getIpMax() {
            return ipMax;
        }

        public void setIpMax(int ipMax) {
            this.ipMax = ipMax;
        }

        public long getIpWindowMs() {
            return ipWindowMs;
        }

        public void setIpWindowMs(long ipWindowMs) {
            this.ipWindowMs = ipWindowMs;
        }
    }
}
