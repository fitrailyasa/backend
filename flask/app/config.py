"""Runtime configuration.

Development and production read MySQL settings from the environment (and `.env`).
Tests use an in-memory SQLite database and never open a MySQL connection.
"""

import os
from urllib.parse import quote_plus

from sqlalchemy.pool import StaticPool


def _env_int(name, default):
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    return int(raw)


def _env_bool(name, default):
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _env_origins(default):
    """Comma separated allowlist. A bare `*` is dropped: never `*` with credentials."""
    raw = os.getenv("CORS_ORIGINS") or os.getenv("CORS_ORIGIN")
    if raw is None or not raw.strip():
        return default
    allowed = [part.strip() for part in raw.split(",") if part.strip() and part.strip() != "*"]
    return allowed or list(default)


def _parse_body_limit(value, default=1_048_576):
    if value is None or str(value).strip() == "":
        return default
    raw = str(value).strip().lower()
    try:
        if raw.endswith("mb"):
            return int(float(raw[:-2]) * 1024 * 1024)
        if raw.endswith("kb"):
            return int(float(raw[:-2]) * 1024)
        return int(raw)
    except ValueError:
        return default


def mysql_uri():
    user = quote_plus(os.getenv("DB_USER", "root"))
    password = quote_plus(os.getenv("DB_PASSWORD", ""))
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "backend_starter")
    charset = os.getenv("DB_CHARSET", "utf8mb4")
    auth = f"{user}:{password}" if password else user
    return f"mysql+pymysql://{auth}@{host}:{port}/{name}?charset={charset}"


class BaseConfig:
    TESTING = False
    DEBUG = False
    PROPAGATE_EXCEPTIONS = False
    JSON_SORT_KEYS = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRES_IN = 3600
    JWT_REFRESH_EXPIRES_IN = 604800
    JWT_ISSUER = "backend-starter-flask"
    JWT_AUDIENCE = "backend-starter-clients"
    JWT_SECRET = "change-me-to-a-long-random-string-at-least-32-chars"
    JWT_ACCESS_SECRET = "change-me-to-a-long-random-string-at-least-32-chars"
    JWT_REFRESH_SECRET = "change-me-to-a-long-random-string-at-least-32-chars"
    BCRYPT_ROUNDS = 10
    PAGINATION_LIMIT = 10
    PAGINATION_MAX_LIMIT = 100
    # Global request limiter: 300 requests / 60s per IP (skipped in tests).
    RATE_LIMIT_WINDOW_MS = 60_000
    RATE_LIMIT_MAX = 300
    RATE_LIMIT_ENABLED = True
    # Extra limiter on the auth routes (register / login / refresh), per endpoint + IP.
    AUTH_RATE_LIMIT_WINDOW_MS = 900_000
    AUTH_RATE_LIMIT_MAX = 100
    # Failed login limiter: sliding windows over normalized email and client IP.
    LOGIN_RATE_LIMIT_MAX = 3
    LOGIN_RATE_LIMIT_WINDOW_MS = 900_000
    LOGIN_IP_RATE_LIMIT_MAX = 10
    LOGIN_IP_RATE_LIMIT_WINDOW_MS = 900_000
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"]
    TRUST_PROXY = False
    ENABLE_HSTS = False
    API_BASE_URL = "http://localhost:5000"
    MAX_CONTENT_LENGTH = 102_400
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://root@127.0.0.1:3306/backend_starter?charset=utf8mb4"


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
    JWT_SECRET = "test-secret-key-that-is-long-enough-1234567890"
    JWT_ACCESS_SECRET = JWT_SECRET
    JWT_REFRESH_SECRET = JWT_SECRET
    BCRYPT_ROUNDS = 4
    # Global and per-route limiters are off in the test env so suites never
    # flake; tests that exercise them re-enable them on the app config.
    RATE_LIMIT_ENABLED = False
    AUTH_RATE_LIMIT_MAX = 100_000
    API_BASE_URL = "http://localhost:5000"


def apply_environment(app):
    """Overlay environment variables onto a non-testing config."""
    secret = os.getenv("JWT_SECRET", app.config["JWT_SECRET"])
    production = os.getenv("FLASK_ENV") == "production" or os.getenv("APP_ENV") == "production"
    if production and (not secret or secret.startswith("change-me") or len(secret) < 32):
        raise RuntimeError("JWT_SECRET must be a random string of at least 32 characters in production")

    app.config["JWT_SECRET"] = secret
    app.config["JWT_ACCESS_SECRET"] = os.getenv("JWT_ACCESS_SECRET") or secret
    app.config["JWT_REFRESH_SECRET"] = os.getenv("JWT_REFRESH_SECRET") or secret
    app.config["JWT_EXPIRES_IN"] = _env_int("JWT_EXPIRES_IN", app.config["JWT_EXPIRES_IN"])
    app.config["JWT_REFRESH_EXPIRES_IN"] = _env_int(
        "JWT_REFRESH_EXPIRES_IN", app.config["JWT_REFRESH_EXPIRES_IN"]
    )
    app.config["JWT_ISSUER"] = os.getenv("JWT_ISSUER", app.config["JWT_ISSUER"])
    app.config["JWT_AUDIENCE"] = os.getenv("JWT_AUDIENCE", app.config["JWT_AUDIENCE"])
    app.config["BCRYPT_ROUNDS"] = _env_int("BCRYPT_ROUNDS", app.config["BCRYPT_ROUNDS"])
    app.config["PAGINATION_LIMIT"] = _env_int("PAGINATION_LIMIT", app.config["PAGINATION_LIMIT"])
    app.config["PAGINATION_MAX_LIMIT"] = _env_int("PAGINATION_MAX_LIMIT", app.config["PAGINATION_MAX_LIMIT"])
    app.config["RATE_LIMIT_WINDOW_MS"] = _env_int("RATE_LIMIT_WINDOW_MS", app.config["RATE_LIMIT_WINDOW_MS"])
    app.config["RATE_LIMIT_MAX"] = _env_int("RATE_LIMIT_MAX", app.config["RATE_LIMIT_MAX"])
    env_name = (os.getenv("FLASK_ENV") or os.getenv("APP_ENV") or "").strip().lower()
    app.config["RATE_LIMIT_ENABLED"] = (
        _env_bool("RATE_LIMIT_ENABLED", app.config["RATE_LIMIT_ENABLED"]) and env_name not in ("test", "testing")
    )
    app.config["AUTH_RATE_LIMIT_WINDOW_MS"] = _env_int(
        "AUTH_RATE_LIMIT_WINDOW_MS", app.config["AUTH_RATE_LIMIT_WINDOW_MS"]
    )
    app.config["AUTH_RATE_LIMIT_MAX"] = _env_int("AUTH_RATE_LIMIT_MAX", app.config["AUTH_RATE_LIMIT_MAX"])
    app.config["LOGIN_RATE_LIMIT_MAX"] = _env_int("LOGIN_RATE_LIMIT_MAX", app.config["LOGIN_RATE_LIMIT_MAX"])
    app.config["LOGIN_RATE_LIMIT_WINDOW_MS"] = _env_int(
        "LOGIN_RATE_LIMIT_WINDOW_MS", app.config["LOGIN_RATE_LIMIT_WINDOW_MS"]
    )
    app.config["LOGIN_IP_RATE_LIMIT_MAX"] = _env_int(
        "LOGIN_IP_RATE_LIMIT_MAX", app.config["LOGIN_IP_RATE_LIMIT_MAX"]
    )
    app.config["LOGIN_IP_RATE_LIMIT_WINDOW_MS"] = _env_int(
        "LOGIN_IP_RATE_LIMIT_WINDOW_MS", app.config["LOGIN_IP_RATE_LIMIT_WINDOW_MS"]
    )
    app.config["TRUST_PROXY"] = _env_bool("TRUST_PROXY", app.config["TRUST_PROXY"])
    app.config["ENABLE_HSTS"] = _env_bool("ENABLE_HSTS", app.config["ENABLE_HSTS"])
    app.config["API_BASE_URL"] = os.getenv("API_BASE_URL", app.config["API_BASE_URL"])
    app.config["MAX_CONTENT_LENGTH"] = _parse_body_limit(os.getenv("BODY_LIMIT"), app.config["MAX_CONTENT_LENGTH"])
    app.config["SQLALCHEMY_DATABASE_URI"] = mysql_uri()

    pool_max = _env_int("DB_POOL_MAX", 10)
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": max(1, pool_max),
    }

    app.config["CORS_ORIGINS"] = _env_origins(app.config["CORS_ORIGINS"])
