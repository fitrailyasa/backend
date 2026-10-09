"""Shared marshmallow fields and the loader that turns failures into 422 envelopes."""

import re

from marshmallow import EXCLUDE, Schema, ValidationError, fields, post_load, pre_load, validates
from marshmallow.validate import Length, OneOf, Range, Regexp

from app.common.errors import ApiError, format_errors
from app.common.slug import SLUG_RE

_INT_RE = re.compile(r"^[1-9]\d*$")


class StripSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    STRIP_FIELDS = ("name", "slug", "description", "email", "search", "tag", "body")

    @pre_load
    def strip_and_drop_blank_slug(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for key, value in data.items():
            if key in self.STRIP_FIELDS and isinstance(value, str):
                cleaned[key] = value.strip()
            else:
                cleaned[key] = value
        if cleaned.get("slug") == "":
            cleaned.pop("slug", None)
        if cleaned.get("search") == "":
            cleaned.pop("search", None)
        if cleaned.get("tag") == "":
            cleaned.pop("tag", None)
        return cleaned


def positive_int(value, minimum=1):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        number = value
    elif isinstance(value, float) and value.is_integer():
        number = int(value)
    elif isinstance(value, str) and _INT_RE.fullmatch(value.strip()):
        number = int(value.strip())
    else:
        return None
    if number < minimum:
        return None
    return number


def optional_slug(max_length):
    return fields.String(
        required=False,
        validate=[
            Length(min=1, max=max_length, error=f"Slug must be between 1 and {max_length} characters."),
            Regexp(SLUG_RE, error="Slug may only contain lowercase letters, numbers and single hyphens."),
        ],
        error_messages={"invalid": "Slug must be a string."},
    )


class PaginationSchema(StripSchema):
    sortable = None

    page = fields.Int(
        load_default=1,
        validate=Range(min=1, max=100000, error="Page must be a positive integer."),
        error_messages={"invalid": "Page must be a positive integer."},
    )
    limit = fields.Int(
        load_default=10,
        error_messages={"invalid": "Limit must be an integer between 1 and 100."},
    )
    search = fields.String(
        load_default=None,
        allow_none=True,
        validate=Length(max=150, error="Search must be at most 150 characters."),
        error_messages={"invalid": "Search must be a string."},
    )
    sort = fields.String(
        load_default="id",
        error_messages={"invalid": "Sort must be a string."},
    )
    order = fields.String(
        load_default="desc",
        validate=OneOf(["asc", "desc"], error="Order must be either asc or desc."),
        error_messages={"invalid": "Order must be a string."},
    )

    @pre_load
    def normalize_query(self, data, **kwargs):
        data = super().strip_and_drop_blank_slug(data, **kwargs)
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for key, value in data.items():
            if isinstance(value, str) and value.strip() == "":
                continue
            cleaned[key] = value
        if isinstance(cleaned.get("order"), str):
            cleaned["order"] = cleaned["order"].strip().lower()
        if isinstance(cleaned.get("sort"), str):
            cleaned["sort"] = cleaned["sort"].strip()
        return cleaned

    @post_load
    def ensure_defaults(self, data, **kwargs):
        data["page"] = int(data.get("page") or 1)
        data["limit"] = int(data.get("limit") or 10)
        data["sort"] = data.get("sort") or "id"
        data["order"] = (data.get("order") or "desc").lower()
        if not isinstance(data.get("include"), list):
            data["include"] = []
        return data

    @validates("sort")
    def validate_sort(self, value, **kwargs):
        allowed = getattr(type(self), "sortable", None)
        if not allowed or value in (None, ""):
            return
        if value not in allowed:
            names = ", ".join(sorted(allowed))
            raise ValidationError(f"Sort must be one of: {names}.")

    @validates("limit")
    def validate_limit(self, value, **kwargs):
        from flask import current_app

        maximum = int(current_app.config["PAGINATION_MAX_LIMIT"])
        if value < 1 or value > maximum:
            raise ValidationError(f"Limit must be an integer between 1 and {maximum}.")


class IncludeField(fields.Field):
    def __init__(self, allowed, **kwargs):
        super().__init__(load_default=lambda: [], **kwargs)
        self.allowed = list(allowed)

    def _deserialize(self, value, attr, data, **kwargs):
        if value is None or value == "":
            return []
        if not isinstance(value, str):
            raise ValidationError("Include must be a comma separated string.")
        entries = [part.strip() for part in value.split(",") if part.strip()]
        invalid = [entry for entry in entries if entry not in self.allowed]
        if invalid:
            allowed = ", ".join(self.allowed)
            joined = ", ".join(invalid)
            raise ValidationError(f"Unsupported include value(s): {joined}. Allowed: {allowed}.")
        return entries


def parse(schema_cls, payload, *, partial=False, context=None):
    schema = schema_cls(context=context or {})
    try:
        return schema.load(payload if payload is not None else {}, partial=partial)
    except ValidationError as exc:
        raise ApiError(422, "Validation failed", errors=format_errors(exc.messages)) from exc
