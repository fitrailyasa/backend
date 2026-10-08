"""User accounts. The password column stores a bcrypt hash and is never serialized."""

from app.extensions import db
from app.models.types import MYSQL_TABLE, TimestampMixin, pk

ROLES = ("user", "admin")


class User(TimestampMixin, db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.UniqueConstraint("email", name="users_email_unique"),
        MYSQL_TABLE,
    )

    id = pk()
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.Enum(*ROLES, name="user_role", native_enum=False, validate_strings=True),
        nullable=False,
        default="user",
        server_default="user",
    )

    orders = db.relationship(
        "Order",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Order.id",
    )
    comments = db.relationship(
        "Comment",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Comment.id",
    )
