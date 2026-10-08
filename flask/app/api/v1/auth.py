"""Auth routes."""

from flask import Blueprint, g, request

from app.common.auth import authenticate, extract_bearer
from app.common.rate_limit import rate_limited
from app.common.requests import json_body
from app.common.responses import created, ok
from app.common.serialize import dump_user
from app.schemas.auth import LoginSchema, RegisterSchema
from app.schemas.common import parse
from app.services import auth_service

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/register")
@rate_limited
def register():
    payload = parse(RegisterSchema, json_body())
    return created("User registered successfully", auth_service.register(payload))


@bp.post("/login")
@rate_limited
def login():
    payload = parse(LoginSchema, json_body())
    return ok("Login successful", auth_service.login(payload["email"], payload["password"]))


@bp.post("/refresh")
@rate_limited
def refresh():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    token = body.get("refresh_token") or body.get("token") or _bearer_refresh()
    return ok("Token refreshed successfully", auth_service.refresh(token))


@bp.post("/logout")
@authenticate
def logout():
    auth_service.logout(g.token_payload)
    return ok("Logged out successfully", None)


@bp.get("/me")
@authenticate
def me():
    user = auth_service.me(g.current_user.id)
    return ok("Authenticated user retrieved", dump_user(user))


def _bearer_refresh():
    token = extract_bearer()
    return token
