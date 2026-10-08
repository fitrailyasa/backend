"""Shared column types."""

from datetime import datetime

from sqlalchemy.dialects.mysql import BIGINT as MYSQL_BIGINT

from app.extensions import db

MYSQL_TABLE = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def unsigned_bigint():
    """INTEGER on SQLite so primary keys autoincrement; BIGINT UNSIGNED on MySQL."""
    return db.Integer().with_variant(MYSQL_BIGINT(unsigned=True), "mysql")


def pk():
    return db.Column(unsigned_bigint(), primary_key=True, autoincrement=True)


def fk(target, ondelete, *, nullable=False, index=True):
    return db.Column(unsigned_bigint(), db.ForeignKey(target, ondelete=ondelete), nullable=nullable, index=index)


class TimestampMixin:
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


def table_args(*constraints):
    return constraints + (MYSQL_TABLE,)
