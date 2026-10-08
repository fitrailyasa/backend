"""Flask application factory."""

import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.common.errors import register_error_handlers
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

    db.init_app(app)
    from app import models  # noqa: F401

    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        supports_credentials=True,
        expose_headers=[
            "X-Request-Id",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "Retry-After",
        ],
    )
    jwt.init_app(app)

    from app.api.v1 import api_v1
    from app.commands import register_commands

    app.register_blueprint(api_v1)
    register_error_handlers(app)
    register_commands(app)
    app.config["STARTED_AT"] = time.monotonic()

    @app.before_request
    def reject_malformed_json():
        if request.method in {"POST", "PUT", "PATCH"} and request.is_json:
            request.get_json(force=False, silent=False)

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
