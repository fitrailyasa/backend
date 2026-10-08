"""Products."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, fk, pk


class Product(TimestampMixin, db.Model):
    __tablename__ = "products"
    __table_args__ = (
        db.UniqueConstraint("slug", name="products_slug_unique"),
        db.CheckConstraint("price >= 0", name="products_price_non_negative"),
        db.CheckConstraint("stock >= 0", name="products_stock_non_negative"),
        MYSQL_TABLE,
    )

    id = pk()
    category_id = fk("categories.id", "RESTRICT")
    name = db.Column(db.String(150), nullable=False)
    slug = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    stock = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    category = db.relationship("Category", back_populates="products")
    tags = db.relationship(
        "Tag",
        secondary="product_tag",
        back_populates="products",
        order_by="Tag.id",
        lazy="select",
    )
    comments = db.relationship(
        "Comment",
        back_populates="product",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Comment.id",
    )
