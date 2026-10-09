"""Product payload validation."""

from marshmallow import ValidationError, fields, post_load, validates
from marshmallow.validate import Length, Range

from app.schemas.common import IncludeField, PaginationSchema, StripSchema, optional_slug, positive_int


def _price_field(*, required):
    return fields.Float(
        required=required,
        validate=Range(min=0, error="Price must be a number greater than or equal to 0."),
        error_messages={
            "required": "Price is required.",
            "null": "Price is required.",
            "invalid": "Price must be a number greater than or equal to 0.",
        },
    )


def _category_field(*, required):
    return fields.Int(
        required=required,
        validate=Range(min=1, error="category_id must be a positive integer."),
        error_messages={
            "required": "category_id is required.",
            "null": "category_id is required.",
            "invalid": "category_id must be a positive integer.",
        },
    )


class ProductListQuerySchema(PaginationSchema):
    sortable = ("id", "name", "slug", "price", "stock", "category_id", "created_at", "updated_at")
    include = IncludeField(["category", "tags"])
    category_id = fields.Int(
        required=False,
        validate=Range(min=1, error="category_id must be a positive integer."),
        error_messages={"invalid": "category_id must be a positive integer."},
    )
    tag_id = fields.Int(
        required=False,
        validate=Range(min=1, error="tag_id must be a positive integer."),
        error_messages={"invalid": "tag_id must be a positive integer."},
    )
    tag = fields.String(required=False, error_messages={"invalid": "tag must be a string."})
    min_price = fields.Float(
        required=False,
        validate=Range(min=0, error="min_price must be a number greater than or equal to 0."),
        error_messages={"invalid": "min_price must be a number greater than or equal to 0."},
    )
    max_price = fields.Float(
        required=False,
        validate=Range(min=0, error="max_price must be a number greater than or equal to 0."),
        error_messages={"invalid": "max_price must be a number greater than or equal to 0."},
    )


class ProductWriteSchema(StripSchema):
    category_id = _category_field(required=True)
    name = fields.String(
        required=True,
        validate=Length(min=2, max=150, error="Name must be between 2 and 150 characters."),
        error_messages={"required": "Name is required.", "null": "Name is required.", "invalid": "Name must be a string."},
    )
    slug = optional_slug(180)
    description = fields.String(required=False, allow_none=True, error_messages={"invalid": "Description must be a string."})
    price = _price_field(required=True)
    stock = fields.Int(
        required=False,
        validate=Range(min=0, error="Stock must be an integer greater than or equal to 0."),
        error_messages={"invalid": "Stock must be an integer greater than or equal to 0."},
    )
    tags = fields.Raw(required=False)

    @validates("tags")
    def validate_tags(self, value, **kwargs):
        _check_tags(value)

    @post_load
    def normalize(self, data, **kwargs):
        if "name" in data and isinstance(data["name"], str):
            data["name"] = data["name"].strip()
        if "description" in data and isinstance(data["description"], str):
            data["description"] = data["description"].strip() or None
        if "tags" in data:
            data["tags"] = [positive_int(entry) for entry in data["tags"]]
        return data


class ProductUpdateSchema(ProductWriteSchema):
    category_id = _category_field(required=False)
    name = fields.String(
        required=False,
        validate=Length(min=2, max=150, error="Name must be between 2 and 150 characters."),
        error_messages={"invalid": "Name must be a string.", "null": "Name is required."},
    )
    price = _price_field(required=False)


def _check_tags(value):
    if value is None:
        return
    if not isinstance(value, list) or len(value) < 1 or len(value) > 20:
        raise ValidationError("tags must be an array of tag ids.")
    for entry in value:
        if positive_int(entry) is None:
            raise ValidationError("tags must be an array of positive integers.")
