"""Product comments."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, fk, pk


class Comment(TimestampMixin, db.Model):
    __tablename__ = "comments"
    __table_args__ = (MYSQL_TABLE,)

    id = pk()
    product_id = fk("products.id", "CASCADE")
    user_id = fk("users.id", "CASCADE")
    body = db.Column(db.Text, nullable=False)

    product = db.relationship("Product", back_populates="comments")
    user = db.relationship("User", back_populates="comments")
