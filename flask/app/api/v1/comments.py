"""Comment routes, including the nested product collection."""

from flask import Blueprint, g

from app.common.auth import authenticate
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_comment
from app.schemas.comment import CommentListQuerySchema, CommentWriteSchema
from app.schemas.common import parse
from app.services import comment_service

comments_bp = Blueprint("comments", __name__, url_prefix="/comments")
product_comments_bp = Blueprint("product_comments", __name__)


@comments_bp.get("/")
def index():
    params = parse(CommentListQuerySchema, query_dict())
    rows, meta = comment_service.list_comments(params)
    return paginated("Comments retrieved", [dump_comment(row) for row in rows], meta)


@comments_bp.patch("/<comment_id>")
@authenticate
def update(comment_id):
    payload = parse(CommentWriteSchema, json_body())
    comment = comment_service.update_comment(path_id(comment_id), payload, g.current_user)
    return ok("Comment updated successfully", dump_comment(comment))


@comments_bp.delete("/<comment_id>")
@authenticate
def destroy(comment_id):
    comment_service.delete_comment(path_id(comment_id), g.current_user)
    return ok("Comment deleted successfully", None)


@product_comments_bp.get("/products/<product_id>/comments")
def index_by_product(product_id):
    params = parse(CommentListQuerySchema, query_dict())
    rows, meta = comment_service.list_comments(params, product_id=path_id(product_id, "productId"))
    return paginated("Comments retrieved", [dump_comment(row) for row in rows], meta)


@product_comments_bp.post("/products/<product_id>/comments")
@authenticate
def store(product_id):
    payload = parse(CommentWriteSchema, json_body())
    comment = comment_service.create_comment(path_id(product_id, "productId"), payload, g.current_user)
    return created("Comment created successfully", dump_comment(comment))
