"""User queries and writes. Passwords are hashed here and never returned."""

from sqlalchemy import or_, select

from app.common.errors import ApiError
from app.common.pagination import apply_sort, count_stmt
from app.common.security import hash_password
from app.extensions import db
from app.models.user import User
from app.services.helpers import get_or_404

SORTABLE = {"id", "name", "email", "role", "created_at", "updated_at"}


def list_users(params):
    stmt = select(User)
    search = params.get("search")
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
    if params.get("role"):
        stmt = stmt.where(User.role == params["role"])
    total = count_stmt(stmt)
    stmt = apply_sort(stmt, User, params.get("sort"), params.get("order"), SORTABLE)
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).all()
    return rows, _meta(total, params)


def get_user(user_id):
    return get_or_404(User, user_id, "User")


def create_user(*, name, email, password, role="user"):
    email = email.strip().lower()
    name = name.strip()
    _ensure_email(email)
    user = User(name=name, email=email, password=hash_password(password), role=role or "user")
    db.session.add(user)
    db.session.commit()
    return user


def update_user(user_id, payload, *, allow_role=True):
    user = get_user(user_id)
    if "email" in payload and payload["email"] and payload["email"] != user.email:
        _ensure_email(payload["email"], exclude_id=user.id)
        user.email = payload["email"]
    if "name" in payload and payload["name"]:
        user.name = payload["name"].strip()
    if payload.get("password"):
        user.password = hash_password(payload["password"])
    if allow_role and payload.get("role"):
        user.role = payload["role"]
    db.session.commit()
    db.session.refresh(user)
    return user


def delete_user(user_id):
    user = get_user(user_id)
    db.session.delete(user)
    db.session.commit()


def _ensure_email(email, exclude_id=None):
    stmt = select(User.id).where(User.email == email)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    if db.session.scalar(stmt):
        raise ApiError(422, "Validation failed", errors={"email": ["The email has already been taken."]})


def _meta(total, params):
    from app.common.pagination import build_meta

    return build_meta(total, params["page"], params["limit"])
