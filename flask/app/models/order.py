"""Orders and snapshotted line items."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, fk, pk

ORDER_STATUSES = ("pending", "paid", "shipped", "completed", "cancelled")


class Order(TimestampMixin, db.Model):
    __tablename__ = "orders"
    __table_args__ = (
        db.CheckConstraint("total >= 0", name="orders_total_non_negative"),
        MYSQL_TABLE,
    )

    id = pk()
    user_id = fk("users.id", "CASCADE")
    status = db.Column(
        db.Enum(*ORDER_STATUSES, name="order_status", native_enum=False, validate_strings=True),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    total = db.Column(db.Numeric(12, 2), nullable=False, default=0)

    user = db.relationship("User", back_populates="orders")
    items = db.relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.id",
        passive_deletes=True,
    )


class OrderItem(TimestampMixin, db.Model):
    __tablename__ = "order_items"
    __table_args__ = (
        db.CheckConstraint("quantity > 0", name="order_items_quantity_positive"),
        db.CheckConstraint("price >= 0", name="order_items_price_non_negative"),
        MYSQL_TABLE,
    )

    id = pk()
    order_id = fk("orders.id", "CASCADE")
    product_id = fk("products.id", "RESTRICT")
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=False)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product")
