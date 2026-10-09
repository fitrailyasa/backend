"""Category payload validation."""

from marshmallow import fields
from marshmallow.validate import Length

from app.schemas.common import IncludeField, PaginationSchema, StripSchema, optional_slug


class CategoryListQuerySchema(PaginationSchema):
    sortable = ("id", "name", "slug", "created_at", "updated_at")
    include = IncludeField(["products"])


class CategoryWriteSchema(StripSchema):
    name = fields.String(
        required=True,
        validate=Length(min=2, max=100, error="Name must be between 2 and 100 characters."),
        error_messages={"required": "Name is required.", "null": "Name is required.", "invalid": "Name must be a string."},
    )
    slug = optional_slug(120)
    description = fields.String(
        required=False,
        allow_none=True,
        error_messages={"invalid": "Description must be a string."},
    )


class CategoryUpdateSchema(CategoryWriteSchema):
    name = fields.String(
        required=False,
        validate=Length(min=2, max=100, error="Name must be between 2 and 100 characters."),
        error_messages={"invalid": "Name must be a string.", "null": "Name is required."},
    )
