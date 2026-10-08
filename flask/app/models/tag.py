"""Tags and the product_tag pivot."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, fk, pk


class Tag(TimestampMixin, db.Model):
    __tablename__ = "tags"
    __table_args__ = (
        db.UniqueConstraint("slug", name="tags_slug_unique"),
        MYSQL_TABLE,
    )

    id = pk()
    name = db.Column(db.String(60), nullable=False)
    slug = db.Column(db.String(80), nullable=False)

    products = db.relationship(
        "Product",
        secondary="product_tag",
        back_populates="tags",
        order_by="Product.id",
        lazy="select",
    )


class ProductTag(db.Model):
    __tablename__ = "product_tag"
    __table_args__ = (
        db.UniqueConstraint("product_id", "tag_id", name="product_tag_product_id_tag_id_unique"),
        MYSQL_TABLE,
    )

    id = pk()
    product_id = fk("products.id", "CASCADE")
    tag_id = fk("tags.id", "CASCADE")
