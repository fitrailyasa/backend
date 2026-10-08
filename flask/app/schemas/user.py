"""User payload validation."""

from marshmallow import ValidationError, fields, post_load, validates, validates_schema
from marshmallow.validate import Length, OneOf
from sqlalchemy import select

from app.extensions import db
from app.models.user import ROLES, User
from app.schemas.common import PaginationSchema, StripSchema


def _email_field(*, required):
    return fields.Email(
        required=required,
        validate=Length(min=3, max=150, error="Email must be between 3 and 150 characters."),
        error_messages={
            "required": "Email is required.",
            "null": "Email is required.",
            "invalid": "The email must be a valid email address.",
        },
    )


def _password_field(*, required):
    return fields.String(
        required=required,
        validate=Length(min=8, max=72, error="Password must be at least 8 characters long."),
        error_messages={
            "required": "Password is required.",
            "null": "Password is required.",
            "invalid": "Password must be a string.",
        },
    )


def _name_field(*, required):
    return fields.String(
        required=required,
        validate=Length(min=2, max=100, error="Name must be between 2 and 100 characters."),
        error_messages={"required": "Name is required.", "null": "Name is required.", "invalid": "Name must be a string."},
    )


def _role_field():
    return fields.String(
        required=False,
        validate=OneOf(list(ROLES), error=f"Role must be one of: {', '.join(ROLES)}."),
        error_messages={"invalid": "Role must be a string."},
    )


class UserListQuerySchema(PaginationSchema):
    role = fields.String(required=False)


class UserCreateSchema(StripSchema):
    name = _name_field(required=True)
    email = _email_field(required=True)
    password = _password_field(required=True)
    role = _role_field()

    @validates("email")
    def email_available(self, value, **kwargs):
        _ensure_email_available(value, self.context.get("user_id"))

    @post_load
    def normalize(self, data, **kwargs):
        if "email" in data:
            data["email"] = data["email"].strip().lower()
        if "name" in data:
            data["name"] = data["name"].strip()
        return data


class UserUpdateSchema(UserCreateSchema):
    name = _name_field(required=False)
    email = _email_field(required=False)
    password = _password_field(required=False)


class ProfileUpdateSchema(StripSchema):
    name = _name_field(required=False)
    email = _email_field(required=False)
    password = _password_field(required=False)
    password_confirmation = fields.String(required=False, allow_none=True)

    @validates("email")
    def email_available(self, value, **kwargs):
        _ensure_email_available(value, self.context.get("user_id"))

    @validates_schema
    def confirmation(self, data, **kwargs):
        confirmation = data.get("password_confirmation")
        password = data.get("password")
        if confirmation not in (None, "") and not password:
            raise ValidationError({"password_confirmation": ["Password is required when password_confirmation is provided."]})
        if confirmation not in (None, "") and password != confirmation:
            raise ValidationError({"password_confirmation": ["password_confirmation must match password."]})

    @post_load
    def normalize(self, data, **kwargs):
        if "email" in data and isinstance(data["email"], str):
            data["email"] = data["email"].strip().lower()
        if "name" in data and isinstance(data["name"], str):
            data["name"] = data["name"].strip()
        data.pop("password_confirmation", None)
        return data


def _ensure_email_available(value, user_id):
    email = value.strip().lower()
    stmt = select(User.id).where(User.email == email)
    if user_id is not None:
        stmt = stmt.where(User.id != user_id)
    if db.session.scalar(stmt):
        raise ValidationError("The email has already been taken.")
