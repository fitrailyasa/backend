"""Import every model so metadata and string relationships resolve."""

from app.models.user import ROLES, User
from app.models.category import Category
from app.models.tag import ProductTag, Tag
from app.models.product import Product
from app.models.order import ORDER_STATUSES, Order, OrderItem
from app.models.comment import Comment

__all__ = [
    "Category",
    "Comment",
    "ORDER_STATUSES",
    "Order",
    "OrderItem",
    "Product",
    "ProductTag",
    "ROLES",
    "Tag",
    "User",
]
