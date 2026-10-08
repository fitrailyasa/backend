"""Shared Flask extensions."""

import time
import uuid

import jwt as pyjwt
from flask import current_app
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from jwt import ExpiredSignatureError, PyJWTError

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()


class JWTManager:
    """PyJWT helper with separate access and refresh secrets and an in-memory denylist."""

    def __init__(self):
        self._blacklist = {}

    def init_app(self, app):
        app.extensions["jwt"] = self

    def clear_blacklist(self):
        self._blacklist.clear()

    def _secret(self, kind):
        if kind == "refresh":
            return current_app.config["JWT_REFRESH_SECRET"] or current_app.config["JWT_SECRET"]
        return current_app.config["JWT_ACCESS_SECRET"] or current_app.config["JWT_SECRET"]

    def _ttl(self, kind):
        if kind == "refresh":
            return int(current_app.config["JWT_REFRESH_EXPIRES_IN"])
        return int(current_app.config["JWT_EXPIRES_IN"])

    def sign(self, user, kind):
        now = int(time.time())
        ttl = self._ttl(kind)
        payload = {
            "sub": str(user.id),
            "role": user.role,
            "typ": kind,
            "iat": now,
            "exp": now + ttl,
            "jti": str(uuid.uuid4()),
            "iss": current_app.config["JWT_ISSUER"],
            "aud": current_app.config["JWT_AUDIENCE"],
        }
        token = pyjwt.encode(payload, self._secret(kind), algorithm=current_app.config["JWT_ALGORITHM"])
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return token

    def decode(self, token, kind):
        from app.common.errors import ApiError

        try:
            payload = pyjwt.decode(
                token,
                self._secret(kind),
                algorithms=[current_app.config["JWT_ALGORITHM"]],
                audience=current_app.config["JWT_AUDIENCE"],
                issuer=current_app.config["JWT_ISSUER"],
                options={"require": ["exp", "iat", "sub"]},
            )
        except ExpiredSignatureError as exc:
            raise ApiError(401, "Token has expired") from exc
        except PyJWTError as exc:
            raise ApiError(401, "Token is invalid") from exc

        if payload.get("typ") != kind or not payload.get("jti") or "role" not in payload:
            raise ApiError(401, "Token is invalid")
        return payload

    def blacklist(self, payload):
        jti = payload.get("jti") if payload else None
        if not jti:
            return
        exp = payload.get("exp")
        if not isinstance(exp, (int, float)):
            exp = time.time() + int(current_app.config["JWT_EXPIRES_IN"])
        self._blacklist[jti] = float(exp)
        self._prune()

    def is_blacklisted(self, payload):
        jti = payload.get("jti") if payload else None
        if not jti:
            return False
        exp = self._blacklist.get(jti)
        if exp is None:
            return False
        if exp <= time.time():
            self._blacklist.pop(jti, None)
            return False
        return True

    def _prune(self):
        if len(self._blacklist) < 1000:
            return
        now = time.time()
        expired = [jti for jti, exp in self._blacklist.items() if exp <= now]
        for jti in expired:
            self._blacklist.pop(jti, None)


jwt = JWTManager()
