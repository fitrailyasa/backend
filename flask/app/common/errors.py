"""API exceptions and global handlers. 500 responses never include a stack trace."""

from flask import current_app
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from app.common.responses import fail
from app.extensions import db


class ApiError(Exception):
    def __init__(self, status_code, message, errors=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.errors = errors


def format_errors(messages):
    if not isinstance(messages, dict):
        return {"_": _as_list(messages)}
    return {str(key): _as_list(value) for key, value in messages.items()}


def _as_list(value, prefix=""):
    if isinstance(value, list):
        messages = []
        for item in value:
            messages.extend(_as_list(item, prefix))
        return messages
    if isinstance(value, dict):
        messages = []
        for key, item in value.items():
            nested = f"{prefix}.{key}" if prefix else str(key)
            messages.extend(_as_list(item, nested))
        return messages
    text = str(value)
    if prefix and not text.startswith(prefix):
        return [f"{prefix}: {text}"]
    return [text]


def _integrity_message(error):
    text = str(getattr(error, "orig", error)).lower()
    if "slug" in text:
        return "The slug has already been taken"
    if any(token in text for token in ("foreign key", "1451", "1452", "referenced")):
        return "Resource is still referenced by other records"
    return "Resource already exists"


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        db.session.rollback()
        return fail(error.message, error.status_code, error.errors)

    @app.errorhandler(IntegrityError)
    def handle_integrity(error):
        db.session.rollback()
        return fail(_integrity_message(error), 409)

    @app.errorhandler(HTTPException)
    def handle_http(error):
        code = error.code or 500
        if code == 404:
            from flask import request

            return fail(f"Route {request.method} {request.path} not found", 404)
        if code == 400:
            return fail("Invalid JSON payload", 400)
        if code == 413:
            return fail("Payload too large", 413)
        if code == 405:
            return fail("Method not allowed", 405)
        if code >= 500:
            current_app.logger.exception("HTTP exception")
            return fail("Internal server error", code)
        return fail(error.description or "Bad request", code)

    @app.errorhandler(Exception)
    def handle_unexpected(error):
        if isinstance(error, (ApiError, HTTPException)):
            raise error
        current_app.logger.exception("Unhandled error")
        db.session.rollback()
        return fail("Internal server error", 500)
