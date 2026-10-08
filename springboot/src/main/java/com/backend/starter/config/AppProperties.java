package com.backend.starter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private boolean seed = false;
    private String corsOrigins = "*";
    private int bcryptRounds = 10;
    private final Jwt jwt = new Jwt();
    private final RateLimit rateLimit = new RateLimit();

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

    public Jwt getJwt() {
        return jwt;
    }

    public RateLimit getRateLimit() {
        return rateLimit;
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

    public static class RateLimit {
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
}
