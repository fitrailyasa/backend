"""Tag payload validation."""

from marshmallow import fields
from marshmallow.validate import Length

from app.schemas.common import IncludeField, PaginationSchema, StripSchema, optional_slug


class TagListQuerySchema(PaginationSchema):
    include = IncludeField(["products"])


class TagWriteSchema(StripSchema):
    name = fields.String(
        required=True,
        validate=Length(min=2, max=60, error="Name must be between 2 and 60 characters."),
        error_messages={"required": "Name is required.", "null": "Name is required.", "invalid": "Name must be a string."},
    )
    slug = optional_slug(80)


class TagUpdateSchema(TagWriteSchema):
    name = fields.String(
        required=False,
        validate=Length(min=2, max=60, error="Name must be between 2 and 60 characters."),
        error_messages={"invalid": "Name must be a string.", "null": "Name is required."},
    )
