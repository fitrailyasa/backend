"""Collection query helpers."""

import math

from sqlalchemy import asc, desc, func, select

from app.extensions import db


def build_meta(total, page, limit):
    total = int(total or 0)
    total_pages = math.ceil(total / limit) if limit else 0
    return {"page": page, "limit": limit, "total": total, "total_pages": total_pages}


def resolve_sort(sort, allowed, default="id"):
    if sort in allowed:
        return sort
    return default if default in allowed else next(iter(allowed))


def count_stmt(stmt):
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))
    return int(total or 0)


def apply_sort(stmt, model, sort, order, allowed):
    column = getattr(model, resolve_sort(sort, allowed))
    direction = asc(column) if order == "asc" else desc(column)
    return stmt.order_by(direction)


def page_window(page, limit):
    return (page - 1) * limit, limit
