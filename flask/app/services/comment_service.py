"""Comment queries and owner-or-admin writes."""

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.common.errors import ApiError
from app.common.pagination import apply_sort, build_meta, count_stmt
from app.extensions import db
from app.models.comment import Comment
from app.models.product import Product
from app.services.helpers import get_or_404

SORTABLE = {"id", "body", "product_id", "user_id", "created_at", "updated_at"}


def list_comments(params, product_id=None):
    if product_id is not None:
        _assert_product(product_id)
    stmt = select(Comment)
    if product_id is not None:
        stmt = stmt.where(Comment.product_id == product_id)
    elif params.get("product_id") is not None:
        stmt = stmt.where(Comment.product_id == params["product_id"])
    if params.get("user_id") is not None:
        stmt = stmt.where(Comment.user_id == params["user_id"])
    search = params.get("search")
    if search:
        stmt = stmt.where(Comment.body.ilike(f"%{search}%"))
    total = count_stmt(stmt)
    stmt = apply_sort(stmt, Comment, params.get("sort"), params.get("order"), SORTABLE)
    stmt = _with_includes(stmt, params.get("include", []))
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).unique().all()
    return rows, build_meta(total, params["page"], params["limit"])


def create_comment(product_id, payload, user):
    _assert_product(product_id)
    comment = Comment(product_id=product_id, user_id=user.id, body=payload["body"].strip())
    db.session.add(comment)
    db.session.commit()
    db.session.refresh(comment)
    return comment


def update_comment(comment_id, payload, user):
    comment = get_or_404(Comment, comment_id, "Comment")
    _assert_owner(comment, user)
    if payload.get("body"):
        comment.body = payload["body"].strip()
    db.session.commit()
    db.session.refresh(comment)
    return comment


def delete_comment(comment_id, user):
    comment = get_or_404(Comment, comment_id, "Comment")
    _assert_owner(comment, user)
    db.session.delete(comment)
    db.session.commit()


def _assert_product(product_id):
    if db.session.get(Product, product_id) is None:
        raise ApiError(404, f"Product with id {product_id} not found")


def _assert_owner(comment, user):
    if user.role == "admin":
        return
    if int(comment.user_id) != int(user.id):
        raise ApiError(403, "This action is unauthorized")


def _with_includes(stmt, include):
    if "user" in include:
        stmt = stmt.options(joinedload(Comment.user))
    if "product" in include:
        stmt = stmt.options(joinedload(Comment.product))
    return stmt
