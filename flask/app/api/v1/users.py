"""User routes. `/users/me` is available to any authenticated user."""

from flask import Blueprint, g

from app.common.auth import authenticate, authorize
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_user
from app.schemas.common import parse
from app.schemas.user import ProfileUpdateSchema, UserCreateSchema, UserListQuerySchema, UserUpdateSchema
from app.services import user_service

bp = Blueprint("users", __name__, url_prefix="/users")


@bp.get("/me")
@authenticate
def show_me():
    return ok("User retrieved", dump_user(user_service.get_user(g.current_user.id)))


@bp.patch("/me")
@authenticate
def update_me():
    payload = parse(ProfileUpdateSchema, json_body(), partial=True, context={"user_id": g.current_user.id})
    user = user_service.update_user(g.current_user.id, payload, allow_role=False)
    return ok("Profile updated successfully", dump_user(user))


@bp.get("/")
@authorize("admin")
def index():
    params = parse(UserListQuerySchema, query_dict())
    rows, meta = user_service.list_users(params)
    return paginated("Users retrieved", [dump_user(row) for row in rows], meta)


@bp.post("/")
@authorize("admin")
def store():
    payload = parse(UserCreateSchema, json_body())
    user = user_service.create_user(
        name=payload["name"],
        email=payload["email"],
        password=payload["password"],
        role=payload.get("role") or "user",
    )
    return created("User created successfully", dump_user(user))


@bp.get("/<user_id>")
@authorize("admin")
def show(user_id):
    user = user_service.get_user(path_id(user_id))
    return ok("User retrieved", dump_user(user))


@bp.put("/<user_id>")
@authorize("admin")
def replace(user_id):
    record_id = path_id(user_id)
    payload = parse(UserCreateSchema, json_body(), context={"user_id": record_id})
    user = user_service.update_user(record_id, payload, allow_role=True)
    return ok("User updated successfully", dump_user(user))


@bp.patch("/<user_id>")
@authorize("admin")
def update(user_id):
    record_id = path_id(user_id)
    payload = parse(UserUpdateSchema, json_body(), partial=True, context={"user_id": record_id})
    user = user_service.update_user(record_id, payload, allow_role=True)
    return ok("User updated successfully", dump_user(user))


@bp.delete("/<user_id>")
@authorize("admin")
def destroy(user_id):
    user_service.delete_user(path_id(user_id))
    return ok("User deleted successfully", None)
