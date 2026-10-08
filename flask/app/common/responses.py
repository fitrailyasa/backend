"""JSON envelopes and the Flask JSON provider."""

from datetime import datetime
from decimal import Decimal

from flask import jsonify
from flask.json.provider import DefaultJSONProvider

from app.common.serialize import format_datetime


class APIJSONProvider(DefaultJSONProvider):
    sort_keys = False

    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, datetime):
            return format_datetime(o)
        return super().default(o)


def ok(message, data=None, status=200):
    response = jsonify({"success": True, "message": message, "data": data})
    response.status_code = status
    return response


def created(message, data=None):
    return ok(message, data, status=201)


def paginated(message, data, meta):
    response = jsonify({"success": True, "message": message, "data": data, "meta": meta})
    response.status_code = 200
    return response


def fail(message, status, errors=None):
    body = {"success": False, "message": message}
    if status == 422 and errors:
        body["errors"] = errors
    response = jsonify(body)
    response.status_code = status
    return response
