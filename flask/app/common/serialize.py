"""Model to JSON dictionaries. Password is never included."""

from datetime import datetime, timezone

from sqlalchemy import inspect as sa_inspect


def format_datetime(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    millis = value.microsecond // 1000
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{millis:03d}Z"


def money(value):
    if value is None:
        return None
    from decimal import Decimal

    quantized = Decimal(str(value)).quantize(Decimal("0.01"))
    number = float(quantized)
    if number.is_integer():
        return int(number)
    return number


def _loaded(obj, name):
    try:
        return name not in sa_inspect(obj).unloaded
    except Exception:
        return False


def dump_user(user):
    if user is None:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": format_datetime(user.created_at),
        "updated_at": format_datetime(user.updated_at),
    }


def dump_tag(tag, *, include_products=False):
    data = {
        "id": tag.id,
        "name": tag.name,
        "slug": tag.slug,
        "created_at": format_datetime(tag.created_at),
        "updated_at": format_datetime(tag.updated_at),
    }
    if include_products and _loaded(tag, "products"):
        data["products"] = [dump_product(product) for product in tag.products]
    return data


def dump_category(category):
    data = {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "created_at": format_datetime(category.created_at),
        "updated_at": format_datetime(category.updated_at),
    }
    if _loaded(category, "products"):
        data["products"] = [dump_product(product) for product in category.products]
    return data


def dump_product(product):
    data = {
        "id": product.id,
        "category_id": product.category_id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "price": money(product.price),
        "stock": int(product.stock),
        "created_at": format_datetime(product.created_at),
        "updated_at": format_datetime(product.updated_at),
    }
    if _loaded(product, "category") and product.category is not None:
        category = product.category
        data["category"] = {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "description": category.description,
            "created_at": format_datetime(category.created_at),
            "updated_at": format_datetime(category.updated_at),
        }
    if _loaded(product, "tags"):
        data["tags"] = [dump_tag(tag) for tag in product.tags]
    return data


def dump_order_item(item):
    data = {
        "id": item.id,
        "order_id": item.order_id,
        "product_id": item.product_id,
        "quantity": int(item.quantity),
        "price": money(item.price),
        "created_at": format_datetime(item.created_at),
        "updated_at": format_datetime(item.updated_at),
    }
    if _loaded(item, "product") and item.product is not None:
        data["product"] = dump_product(item.product)
    return data


def dump_order(order):
    data = {
        "id": order.id,
        "user_id": order.user_id,
        "status": order.status,
        "total": money(order.total),
        "created_at": format_datetime(order.created_at),
        "updated_at": format_datetime(order.updated_at),
    }
    if _loaded(order, "items"):
        data["items"] = [dump_order_item(item) for item in order.items]
    if _loaded(order, "user") and order.user is not None:
        data["user"] = dump_user(order.user)
    return data


def dump_comment(comment):
    data = {
        "id": comment.id,
        "product_id": comment.product_id,
        "user_id": comment.user_id,
        "body": comment.body,
        "created_at": format_datetime(comment.created_at),
        "updated_at": format_datetime(comment.updated_at),
    }
    if _loaded(comment, "user") and comment.user is not None:
        data["user"] = dump_user(comment.user)
    if _loaded(comment, "product") and comment.product is not None:
        data["product"] = dump_product(comment.product)
    return data
