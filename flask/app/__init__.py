"""Flask application factory."""

import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from sqlalchemy import event
from sqlalchemy.engine import Engine
from werkzeug.middleware.proxy_fix import ProxyFix

from app.common.errors import register_error_handlers
from app.common.rate_limit import enforce_global_rate_limit
from app.common.responses import APIJSONProvider
from app.config import DevelopmentConfig, ProductionConfig, TestingConfig, apply_environment
from app.extensions import cors, db, jwt, migrate

_CONFIGS = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    module = getattr(dbapi_connection.__class__, "__module__", "")
    if "sqlite" not in module:
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def create_app(config=None):
    app = Flask(__name__)
    app.json_provider_class = APIJSONProvider
    app.json.sort_keys = False
    app.url_map.strict_slashes = False

    config_obj = _resolve_config(config)
    app.config.from_object(config_obj)
    if not app.config.get("TESTING"):
        apply_environment(app)

    if app.config.get("TRUST_PROXY"):
        # The only place X-Forwarded-For/X-Forwarded-Proto are honoured.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    _suppress_server_fingerprint()

    db.init_app(app)
    from app import models  # noqa: F401

    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/*": {"origins": _cors_origins(app)}},
        supports_credentials=True,
        expose_headers=[
            "X-Request-Id",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "Retry-After",
        ],
        max_age=600,
    )
    jwt.init_app(app)

    from app.api.v1 import api_v1
    from app.commands import register_commands

    app.register_blueprint(api_v1)
    register_error_handlers(app)
    register_commands(app)
    app.config["STARTED_AT"] = time.monotonic()

    # Registered first so limiting runs before the body is read.
    @app.before_request
    def global_rate_limit():
        return enforce_global_rate_limit()

    @app.before_request
    def reject_malformed_json():
        if request.method in {"POST", "PUT", "PATCH"} and request.is_json:
            request.get_json(force=False, silent=False)

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = _content_security_policy(request.path)
        if app.config.get("ENABLE_HSTS") and request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        for header in ("Server", "X-Powered-By", "X-AspNet-Version"):
            if header in response.headers:
                del response.headers[header]
        return response

    @app.get("/health")
    def health():
        started = app.config.get("STARTED_AT", time.monotonic())
        return jsonify(
            {
                "status": "ok",
                "uptime": time.monotonic() - started,
                "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            }
        )

    from app.docs import register_docs

    register_docs(app)
    return app


def _resolve_config(config):
    if config is None:
        env_name = os.getenv("FLASK_ENV", os.getenv("APP_ENV", "development"))
        if env_name != "testing":
            _load_dotenv()
        return _CONFIGS.get(env_name, DevelopmentConfig)

    if isinstance(config, str):
        if config != "testing":
            _load_dotenv()
        if config not in _CONFIGS:
            raise RuntimeError(f"Unknown config '{config}'")
        return _CONFIGS[config]

    if getattr(config, "TESTING", False) is not True:
        _load_dotenv()
    return config


def _load_dotenv():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)


_DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173", "http://localhost:4200"]

# Swagger UI lives under /api/v1/docs and runs inline script/style from this
# same origin; every other response gets `default-src 'none'`.
_DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"
)


def _cors_origins(app):
    """Concrete allowlist: `*` is never combined with credentials."""
    origins = app.config.get("CORS_ORIGINS") or _DEFAULT_CORS_ORIGINS
    if isinstance(origins, str):
        origins = [part.strip() for part in origins.split(",") if part.strip()]
    allowed = [origin for origin in origins if origin.strip() and origin.strip() != "*"]
    return allowed or list(_DEFAULT_CORS_ORIGINS)


def _content_security_policy(path):
    if path.startswith("/api/v1/docs"):
        return _DOCS_CSP
    return "default-src 'none'"


def _suppress_server_fingerprint():
    """Drop `Server: Werkzeug/x.y.z Python/...` from dev-server responses."""
    from werkzeug.serving import WSGIRequestHandler

    if getattr(WSGIRequestHandler, "_fingerprint_suppressed", False):
        return
    original_send_header = WSGIRequestHandler.send_header

    def send_header(self, key, value):
        if key.lower() in {"server", "x-powered-by"}:
            return
        original_send_header(self, key, value)

    WSGIRequestHandler.send_header = send_header
    WSGIRequestHandler._fingerprint_suppressed = True
