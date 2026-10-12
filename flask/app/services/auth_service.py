"""Registration, login, refresh, and logout."""

from flask import current_app
from sqlalchemy import select

from app.common.errors import ApiError
from app.common.security import verify_password
from app.common.serialize import dump_user
from app.extensions import db, jwt
from app.models.user import User
from app.services.user_service import create_user, get_user

# One generic message for "unknown email" and "wrong password" alike.
INVALID_CREDENTIALS = "These credentials do not match our records"

# Fixed digest compared when the email does not exist so the response timing
# does not reveal whether an account is registered.
_DUMMY_HASH = "$2b$10$TztlD1zLCzq9jhelWJBMoOLJv9AnZEjZZMsPDxq5Gu./yG5ts2WDe"


def issue_pair(user):
    return {
        "user": dump_user(user),
        "token": jwt.sign(user, "access"),
        "refresh_token": jwt.sign(user, "refresh"),
        "token_type": "Bearer",
        "expires_in": int(current_app.config["JWT_EXPIRES_IN"]),
    }


def register(payload):
    user = create_user(name=payload["name"], email=payload["email"], password=payload["password"], role="user")
    return issue_pair(user)


def login(email, password):
    user = db.session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        # Spend comparable time on unknown emails (timing side channel).
        verify_password(password, _DUMMY_HASH)
        raise ApiError(401, INVALID_CREDENTIALS)
    if not verify_password(password, user.password):
        raise ApiError(401, INVALID_CREDENTIALS)
    return issue_pair(user)


def refresh(token):
    if not token:
        raise ApiError(401, "Refresh token is missing")
    payload = jwt.decode(token, "refresh")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise ApiError(401, "Token is invalid") from exc
    user = db.session.get(User, user_id)
    if user is None:
        raise ApiError(401, "Token is invalid")
    return issue_pair(user)


def logout(payload):
    jwt.blacklist(payload)
    return True


def me(user_id):
    return get_user(user_id)
