"""Comment payload validation."""

from marshmallow import ValidationError, fields, post_load, validates
from marshmallow.validate import Range

from app.schemas.common import IncludeField, PaginationSchema, StripSchema


class CommentListQuerySchema(PaginationSchema):
    include = IncludeField(["user", "product"])
    product_id = fields.Int(
        required=False,
        validate=Range(min=1, error="product_id must be a positive integer."),
        error_messages={"invalid": "product_id must be a positive integer."},
    )
    user_id = fields.Int(
        required=False,
        validate=Range(min=1, error="user_id must be a positive integer."),
        error_messages={"invalid": "user_id must be a positive integer."},
    )


class CommentWriteSchema(StripSchema):
    body = fields.String(
        required=True,
        error_messages={"required": "Body is required.", "null": "Body is required.", "invalid": "Body must be a string."},
    )

    @validates("body")
    def validate_body(self, value, **kwargs):
        if not isinstance(value, str) or value.strip() == "":
            raise ValidationError("Body is required.")
        if len(value.strip()) > 2000:
            raise ValidationError("Body must be between 1 and 2000 characters.")

    @post_load
    def normalize(self, data, **kwargs):
        data["body"] = data["body"].strip()
        return data
