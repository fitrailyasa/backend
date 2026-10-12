package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Env                 string
	Host                string
	Port                int
	BaseURL             string
	Prefix              string
	CORSOrigin          string
	BodyLimit           int64
	Dialect             string
	DBHost              string
	DBPort              int
	DBName              string
	DBUser              string
	DBPassword          string
	Storage             string
	Sync                bool
	DBLogging           bool
	JWTSecret           string
	AccessSecret        string
	RefreshSecret       string
	ExpiresIn           int
	RefreshExpiresIn    int
	Issuer              string
	Audience            string
	BcryptRounds        int
	PageLimit           int
	PageMax             int
	RateWindowMS        int
	RateMax             int
	RateEnabled         bool
	LoginRateMax        int
	LoginRateWindowMS   int
	LoginIPRateMax      int
	LoginIPRateWindowMS int
	TrustProxy          bool
	EnableHSTS          bool
}

// DefaultCORSOrigins is the allowlist used when no CORS origin is configured.
const DefaultCORSOrigins = "http://localhost:3000,http://localhost:5173,http://localhost:4200"

func Load() Config {
	_ = godotenv.Load()
	secret := getenv("JWT_SECRET", "change-me-to-a-long-random-string-at-least-32-chars")
	access := getenv("JWT_ACCESS_SECRET", "")
	refresh := getenv("JWT_REFRESH_SECRET", "")
	if access == "" {
		access = secret
	}
	if refresh == "" {
		refresh = secret
	}
	return Config{
		Env:                 getenv("APP_ENV", "development"),
		Host:                getenv("HOST", "0.0.0.0"),
		Port:                getenvInt("PORT", 8090),
		BaseURL:             getenv("API_BASE_URL", "http://localhost:8090"),
		Prefix:              getenv("API_PREFIX", "/api/v1"),
		CORSOrigin:          corsOrigins(),
		BodyLimit:           parseBodyLimit(getenv("BODY_LIMIT", "100kb")),
		Dialect:             strings.ToLower(getenv("DB_DIALECT", "mysql")),
		DBHost:              getenv("DB_HOST", "127.0.0.1"),
		DBPort:              getenvInt("DB_PORT", 3306),
		DBName:              getenv("DB_NAME", "backend_starter"),
		DBUser:              getenv("DB_USER", "root"),
		DBPassword:          os.Getenv("DB_PASSWORD"),
		Storage:             getenv("DB_STORAGE", "./database/dev.sqlite"),
		Sync:                getenvBool("DB_SYNC", false),
		DBLogging:           getenvBool("DB_LOGGING", false),
		JWTSecret:           secret,
		AccessSecret:        access,
		RefreshSecret:       refresh,
		ExpiresIn:           getenvInt("JWT_EXPIRES_IN", 3600),
		RefreshExpiresIn:    getenvInt("JWT_REFRESH_EXPIRES_IN", 604800),
		Issuer:              getenv("JWT_ISSUER", "backend-starter-go"),
		Audience:            getenv("JWT_AUDIENCE", "backend-starter-clients"),
		BcryptRounds:        getenvInt("BCRYPT_ROUNDS", 10),
		PageLimit:           getenvInt("PAGINATION_LIMIT", 10),
		PageMax:             getenvInt("PAGINATION_MAX_LIMIT", 100),
		RateWindowMS:        getenvInt("RATE_LIMIT_WINDOW_MS", 60000),
		RateMax:             getenvInt("RATE_LIMIT_MAX", 300),
		RateEnabled:         getenvBool("RATE_LIMIT_ENABLED", true),
		LoginRateMax:        getenvInt("LOGIN_RATE_LIMIT_MAX", 3),
		LoginRateWindowMS:   getenvInt("LOGIN_RATE_LIMIT_WINDOW_MS", 900000),
		LoginIPRateMax:      getenvInt("LOGIN_IP_RATE_LIMIT_MAX", 10),
		LoginIPRateWindowMS: getenvInt("LOGIN_IP_RATE_LIMIT_WINDOW_MS", 900000),
		TrustProxy:          getenvBool("TRUST_PROXY", false),
		EnableHSTS:          getenvBool("ENABLE_HSTS", false),
	}
}

// corsOrigins reads the CORS allowlist. CORS_ORIGINS is the documented key;
// the older CORS_ORIGIN is still honoured so existing .env files keep working.
func corsOrigins() string {
	if value := getenv("CORS_ORIGINS", ""); value != "" {
		return value
	}
	return getenv("CORS_ORIGIN", DefaultCORSOrigins)
}

func getenv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func getenvBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	return raw == "1" || raw == "true" || raw == "yes"
}

func parseBodyLimit(raw string) int64 {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return 1 << 20
	}
	mult := int64(1)
	switch {
	case strings.HasSuffix(raw, "mb"):
		mult = 1 << 20
		raw = strings.TrimSuffix(raw, "mb")
	case strings.HasSuffix(raw, "kb"):
		mult = 1 << 10
		raw = strings.TrimSuffix(raw, "kb")
	}
	n, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || n <= 0 {
		return 1 << 20
	}
	return n * mult
}
