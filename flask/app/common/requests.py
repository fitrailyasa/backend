"""Request body and path helpers."""

from flask import request

from app.common.errors import ApiError


def json_body():
    data = request.get_json(silent=True) if request.is_json or request.data else None
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ApiError(400, "Invalid JSON payload")
    return data


def query_dict():
    return request.args.to_dict(flat=True)


def path_id(value, field="id"):
    if isinstance(value, bool):
        raise ApiError(422, "Validation failed", errors={field: [f"{field} must be a positive integer."]})
    if isinstance(value, int) and value >= 1:
        return value
    text = str(value).strip()
    if text.isdigit() and int(text) >= 1:
        return int(text)
    raise ApiError(422, "Validation failed", errors={field: [f"{field} must be a positive integer."]})
