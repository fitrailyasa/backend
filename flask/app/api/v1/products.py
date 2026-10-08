"""Product routes."""

from flask import Blueprint

from app.common.auth import authorize
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_product
from app.schemas.common import parse
from app.schemas.product import ProductListQuerySchema, ProductUpdateSchema, ProductWriteSchema
from app.services import product_service

bp = Blueprint("products", __name__, url_prefix="/products")


@bp.get("/")
def index():
    params = parse(ProductListQuerySchema, query_dict())
    rows, meta = product_service.list_products(params)
    return paginated("Products retrieved", [dump_product(row) for row in rows], meta)


@bp.get("/<product_id>")
def show(product_id):
    params = parse(ProductListQuerySchema, query_dict())
    product = product_service.get_product(path_id(product_id), params)
    return ok("Product retrieved", dump_product(product))


@bp.post("/")
@authorize("admin")
def store():
    payload = parse(ProductWriteSchema, json_body())
    product = product_service.create_product(payload)
    return created("Product created successfully", dump_product(product))


@bp.put("/<product_id>")
@authorize("admin")
def replace(product_id):
    record_id = path_id(product_id)
    payload = parse(ProductWriteSchema, json_body())
    product = product_service.update_product(record_id, payload)
    return ok("Product updated successfully", dump_product(product))


@bp.patch("/<product_id>")
@authorize("admin")
def update(product_id):
    record_id = path_id(product_id)
    payload = parse(ProductUpdateSchema, json_body(), partial=True)
    product = product_service.update_product(record_id, payload)
    return ok("Product updated successfully", dump_product(product))


@bp.delete("/<product_id>")
@authorize("admin")
def destroy(product_id):
    product_service.delete_product(path_id(product_id))
    return ok("Product deleted successfully", None)
