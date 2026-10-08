"""Authentication and authorization decorators."""

from functools import wraps

from flask import g, request

from app.common.errors import ApiError
from app.extensions import db, jwt
from app.models.user import User


def extract_bearer():
    header = request.headers.get("Authorization", "")
    if not isinstance(header, str) or not header.strip():
        return None
    parts = header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        return None
    return parts[1].strip()


def authenticate_request():
    # Always re-read the bearer token. `g` lives on the app context, so a
    # previous request in the same context must not be reused.
    token = extract_bearer()
    if not token:
        raise ApiError(401, "Authentication token is missing")

    payload = jwt.decode(token, "access")
    if jwt.is_blacklisted(payload):
        raise ApiError(401, "Token has been revoked")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise ApiError(401, "Token is invalid") from exc

    user = db.session.get(User, user_id)
    if user is None:
        raise ApiError(401, "Token is invalid")

    g.current_user = user
    g.token_payload = payload
    g.access_token = token


def authenticate(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        authenticate_request()
        return fn(*args, **kwargs)

    return wrapper


def authorize(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            authenticate_request()
            if roles and g.current_user.role not in roles:
                raise ApiError(403, "This action is unauthorized")
            return fn(*args, **kwargs)

        return wrapper

    return decorator
