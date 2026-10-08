"""Initial schema for backend_starter.

Revision ID: 20261008_0001
Revises:
Create Date: 2026-10-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = "20261008_0001"
down_revision = None
branch_labels = None
depends_on = None

MYSQL = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
USER_ROLE = sa.Enum("user", "admin", name="user_role")
ORDER_STATUS = sa.Enum("pending", "paid", "shipped", "completed", "cancelled", name="order_status")


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=False),
        sa.Column("role", USER_ROLE, nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="users_email_unique"),
        **MYSQL,
    )
    op.create_table(
        "categories",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="categories_slug_unique"),
        **MYSQL,
    )
    op.create_table(
        "tags",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="tags_slug_unique"),
        **MYSQL,
    )
    op.create_table(
        "products",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("category_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("price >= 0", name="products_price_non_negative"),
        sa.CheckConstraint("stock >= 0", name="products_stock_non_negative"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name="products_category_id_fkey", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="products_slug_unique"),
        **MYSQL,
    )
    op.create_index("products_category_id_idx", "products", ["category_id"])
    op.create_table(
        "product_tag",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("product_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("tag_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="product_tag_product_id_fkey", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], name="product_tag_tag_id_fkey", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "tag_id", name="product_tag_product_id_tag_id_unique"),
        **MYSQL,
    )
    op.create_table(
        "orders",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("status", ORDER_STATUS, nullable=False, server_default="pending"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("total >= 0", name="orders_total_non_negative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="orders_user_id_fkey", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("orders_user_id_idx", "orders", ["user_id"])
    op.create_table(
        "order_items",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("order_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("product_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="order_items_quantity_positive"),
        sa.CheckConstraint("price >= 0", name="order_items_price_non_negative"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name="order_items_order_id_fkey", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="order_items_product_id_fkey", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("order_items_order_id_idx", "order_items", ["order_id"])
    op.create_index("order_items_product_id_idx", "order_items", ["product_id"])
    op.create_table(
        "comments",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("product_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("user_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="comments_product_id_fkey", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="comments_user_id_fkey", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("comments_product_id_idx", "comments", ["product_id"])
    op.create_index("comments_user_id_idx", "comments", ["user_id"])


def downgrade():
    op.drop_table("comments")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("product_tag")
    op.drop_table("products")
    op.drop_table("tags")
    op.drop_table("categories")
    op.drop_table("users")
    ORDER_STATUS.drop(op.get_bind(), checkfirst=True)
    USER_ROLE.drop(op.get_bind(), checkfirst=True)
