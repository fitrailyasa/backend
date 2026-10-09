"""Auth payload validation."""

from marshmallow import ValidationError, fields, post_load, validates, validates_schema
from marshmallow.validate import Length

from app.schemas.common import StripSchema


class RegisterSchema(StripSchema):
    name = fields.String(
        required=True,
        validate=Length(min=2, max=100, error="Name must be between 2 and 100 characters."),
        error_messages={"required": "Name is required.", "null": "Name is required.", "invalid": "Name must be a string."},
    )
    email = fields.Email(
        required=True,
        validate=Length(min=3, max=150, error="Email must be between 3 and 150 characters."),
        error_messages={
            "required": "Email is required.",
            "null": "Email is required.",
            "invalid": "The email must be a valid email address.",
        },
    )
    password = fields.String(
        required=True,
        validate=Length(min=8, max=72, error="Password must be at least 8 characters long."),
        error_messages={"required": "Password is required.", "null": "Password is required.", "invalid": "Password must be a string."},
    )
    password_confirmation = fields.String(
        required=True,
        error_messages={
            "required": "password_confirmation is required.",
            "null": "password_confirmation is required.",
            "invalid": "password_confirmation must match password.",
        },
    )

    @validates_schema(pass_original=True, skip_on_field_errors=False)
    def passwords_match(self, data, original, **kwargs):
        if not isinstance(original, dict):
            return
        password = original.get("password")
        confirmation = original.get("password_confirmation")
        if password != confirmation:
            raise ValidationError({"password_confirmation": ["password_confirmation must match password."]})

    @post_load
    def cleanup(self, data, **kwargs):
        data["email"] = data["email"].strip().lower()
        data["name"] = data["name"].strip()
        data.pop("password_confirmation", None)
        return data


class LoginSchema(StripSchema):
    email = fields.Email(
        required=True,
        validate=Length(min=3, max=150, error="Email must be between 3 and 150 characters."),
        error_messages={
            "required": "Email is required.",
            "null": "Email is required.",
            "invalid": "The email must be a valid email address.",
        },
    )
    password = fields.String(
        required=True,
        error_messages={"required": "Password is required.", "null": "Password is required.", "invalid": "Password must be a string."},
    )

    @post_load
    def normalize(self, data, **kwargs):
        data["email"] = data["email"].strip().lower()
        return data
