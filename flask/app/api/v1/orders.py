"""Order routes."""

from flask import Blueprint, g

from app.common.auth import authenticate, authorize
from app.common.errors import ApiError
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_order
from app.schemas.common import parse
from app.schemas.order import OrderCreateSchema, OrderListQuerySchema, OrderStatusSchema
from app.services import order_service

bp = Blueprint("orders", __name__, url_prefix="/orders")


@bp.get("/")
@authenticate
def index():
    raw = query_dict()
    params = parse(OrderListQuerySchema, raw)
    if raw.get("user_id") not in (None, "") and g.current_user.role != "admin":
        raise ApiError(403, "The user_id filter is only available to administrators")
    rows, meta = order_service.list_orders(params, g.current_user)
    return paginated("Orders retrieved", [dump_order(row) for row in rows], meta)


@bp.post("/")
@authenticate
def store():
    payload = parse(OrderCreateSchema, json_body())
    order = order_service.create_order(payload, g.current_user)
    return created("Order created successfully", dump_order(order))


@bp.get("/<order_id>")
@authenticate
def show(order_id):
    params = parse(OrderListQuerySchema, query_dict())
    order = order_service.get_order(path_id(order_id), g.current_user, params)
    return ok("Order retrieved", dump_order(order))


@bp.patch("/<order_id>/status")
@authenticate
def update_status(order_id):
    payload = parse(OrderStatusSchema, json_body())
    order = order_service.update_status(path_id(order_id), payload["status"], g.current_user)
    return ok("Order status updated successfully", dump_order(order))


@bp.delete("/<order_id>")
@authorize("admin")
def destroy(order_id):
    order_service.delete_order(path_id(order_id), g.current_user)
    return ok("Order deleted successfully", None)
