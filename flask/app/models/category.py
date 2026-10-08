"""Product categories."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, pk


class Category(TimestampMixin, db.Model):
    __tablename__ = "categories"
    __table_args__ = (
        db.UniqueConstraint("slug", name="categories_slug_unique"),
        MYSQL_TABLE,
    )

    id = pk()
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)

    products = db.relationship(
        "Product",
        back_populates="category",
        order_by="Product.id",
        passive_deletes=True,
    )
