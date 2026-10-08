"""Category routes."""

from flask import Blueprint

from app.common.auth import authorize
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_category
from app.schemas.category import CategoryListQuerySchema, CategoryUpdateSchema, CategoryWriteSchema
from app.schemas.common import parse
from app.services import category_service

bp = Blueprint("categories", __name__, url_prefix="/categories")


@bp.get("/")
def index():
    params = parse(CategoryListQuerySchema, query_dict())
    rows, meta = category_service.list_categories(params)
    return paginated("Categories retrieved", [dump_category(row) for row in rows], meta)


@bp.get("/<category_id>")
def show(category_id):
    params = parse(CategoryListQuerySchema, query_dict())
    category = category_service.get_category(path_id(category_id), params)
    return ok("Category retrieved", dump_category(category))


@bp.post("/")
@authorize("admin")
def store():
    payload = parse(CategoryWriteSchema, json_body())
    category = category_service.create_category(payload)
    return created("Category created successfully", dump_category(category))


@bp.put("/<category_id>")
@authorize("admin")
def replace(category_id):
    record_id = path_id(category_id)
    payload = parse(CategoryWriteSchema, json_body())
    category = category_service.update_category(record_id, payload)
    return ok("Category updated successfully", dump_category(category))


@bp.patch("/<category_id>")
@authorize("admin")
def update(category_id):
    record_id = path_id(category_id)
    payload = parse(CategoryUpdateSchema, json_body(), partial=True)
    category = category_service.update_category(record_id, payload)
    return ok("Category updated successfully", dump_category(category))


@bp.delete("/<category_id>")
@authorize("admin")
def destroy(category_id):
    category_service.delete_category(path_id(category_id))
    return ok("Category deleted successfully", None)
