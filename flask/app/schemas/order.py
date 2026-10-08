"""Order payload validation."""

from marshmallow import ValidationError, fields, post_load, validates
from marshmallow.validate import OneOf, Range

from app.models.order import ORDER_STATUSES
from app.schemas.common import IncludeField, PaginationSchema, StripSchema, positive_int

_STATUS_MESSAGE = f"Status must be one of: {', '.join(ORDER_STATUSES)}."


class OrderListQuerySchema(PaginationSchema):
    include = IncludeField(["items", "items.product", "user"])
    status = fields.String(
        required=False,
        validate=OneOf(list(ORDER_STATUSES), error=_STATUS_MESSAGE),
        error_messages={"invalid": "Status must be a string."},
    )
    user_id = fields.Int(
        required=False,
        validate=Range(min=1, error="user_id must be a positive integer."),
        error_messages={"invalid": "user_id must be a positive integer."},
    )


class OrderCreateSchema(StripSchema):
    items = fields.Raw(
        required=True,
        error_messages={"required": "Items is required.", "null": "Items is required.", "invalid": "Items must be a non-empty array."},
    )

    @validates("items")
    def validate_items(self, value, **kwargs):
        if value is None or value == "" or value is False:
            raise ValidationError("Items is required.")
        if not isinstance(value, list) or len(value) < 1 or len(value) > 100:
            raise ValidationError("Items must be a non-empty array.")
        for index, item in enumerate(value):
            if not isinstance(item, dict):
                raise ValidationError(f"items.{index} must be an object.")
            if positive_int(item.get("product_id")) is None:
                raise ValidationError(f"items.{index}.product_id must be a positive integer.")
            if positive_int(item.get("quantity")) is None:
                raise ValidationError(f"items.{index}.quantity must be an integer greater than or equal to 1.")

    @post_load
    def normalize(self, data, **kwargs):
        data["items"] = [
            {"product_id": positive_int(item["product_id"]), "quantity": positive_int(item["quantity"])}
            for item in data["items"]
        ]
        return data


class OrderStatusSchema(StripSchema):
    status = fields.String(
        required=True,
        validate=OneOf(list(ORDER_STATUSES), error=_STATUS_MESSAGE),
        error_messages={"required": "Status is required.", "null": "Status is required.", "invalid": "Status must be a string."},
    )
