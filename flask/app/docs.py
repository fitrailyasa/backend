"""Swagger UI backed by the shared OpenAPI document."""

from pathlib import Path

from flask import Flask, Response
from flask_swagger_ui import get_swaggerui_blueprint

_SPEC = Path(__file__).with_name("openapi.json")


def register_docs(app: Flask) -> None:
    @app.get("/api/v1/docs.json")
    def openapi_document():
        return Response(_SPEC.read_bytes(), mimetype="application/json")

    app.register_blueprint(
        get_swaggerui_blueprint(
            "/api/v1/docs",
            "/api/v1/docs.json",
            config={
                "app_name": "Backend Starter Kit API",
                "persistAuthorization": True,
                "docExpansion": "list",
                "deepLinking": True,
            },
            blueprint_name="swagger_ui",
        )
    )
