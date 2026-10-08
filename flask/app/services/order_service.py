"""Order creation, stock, and status transitions."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.common.errors import ApiError
from app.common.pagination import apply_sort, build_meta, count_stmt
from app.extensions import db
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.services.helpers import get_or_404

SORTABLE = {"id", "status", "total", "user_id", "created_at", "updated_at"}


def list_orders(params, user):
    stmt = select(Order)
    if user.role == "admin":
        if params.get("user_id") is not None:
            stmt = stmt.where(Order.user_id == params["user_id"])
    else:
        stmt = stmt.where(Order.user_id == user.id)
    if params.get("status"):
        stmt = stmt.where(Order.status == params["status"])
    total = count_stmt(stmt)
    stmt = apply_sort(stmt, Order, params.get("sort"), params.get("order"), SORTABLE)
    stmt = _with_includes(stmt, params.get("include", []))
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).unique().all()
    return rows, build_meta(total, params["page"], params["limit"])


def get_order(order_id, user, params=None):
    params = params or {}
    stmt = _with_includes(select(Order).where(Order.id == order_id), params.get("include", []))
    order = db.session.scalars(stmt).unique().first()
    if order is None:
        raise ApiError(404, "Order not found")
    _assert_owner(order, user)
    return order


def create_order(payload, user):
    items = _merge_items(payload.get("items") or [])
    product_ids = [item["product_id"] for item in items]
    try:
        products = _lock_products(product_ids)
        by_id = {product.id: product for product in products}
        for item in items:
            if item["product_id"] not in by_id:
                raise ApiError(404, f'Product with id {item["product_id"]} not found')
        for item in items:
            product = by_id[item["product_id"]]
            if int(product.stock) < item["quantity"]:
                raise ApiError(409, f'Insufficient stock for product "{product.name}"')

        order = Order(user_id=user.id, status="pending", total=Decimal("0.00"))
        db.session.add(order)
        db.session.flush()

        total = Decimal("0.00")
        for item in items:
            product = by_id[item["product_id"]]
            unit = Decimal(str(product.price)).quantize(Decimal("0.01"))
            line = (unit * item["quantity"]).quantize(Decimal("0.01"))
            total += line
            db.session.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=item["quantity"],
                    price=unit,
                )
            )
            product.stock = int(product.stock) - item["quantity"]

        order.total = total.quantize(Decimal("0.01"))
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return _reload(order.id, ["items", "items.product"])


def update_status(order_id, status, user):
    order = get_or_404(Order, order_id, "Order")
    _assert_owner(order, user)
    if order.status == status:
        return order
    if user.role != "admin":
        if not (order.status == "pending" and status == "cancelled"):
            raise ApiError(403, "This action is unauthorized")
    try:
        previous = order.status
        if previous != "cancelled" and status == "cancelled":
            _adjust_stock(order, "increment")
        elif previous == "cancelled" and status != "cancelled":
            _adjust_stock(order, "decrement")
        order.status = status
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    db.session.refresh(order)
    return order


def delete_order(order_id, user):
    order = get_or_404(Order, order_id, "Order")
    if user.role != "admin":
        raise ApiError(403, "This action is unauthorized")
    try:
        if order.status != "cancelled":
            _adjust_stock(order, "increment")
        db.session.delete(order)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _merge_items(raw_items):
    merged = {}
    order = []
    for item in raw_items:
        product_id = int(item["product_id"])
        quantity = int(item["quantity"])
        if product_id not in merged:
            order.append(product_id)
            merged[product_id] = 0
        merged[product_id] += quantity
    return [{"product_id": product_id, "quantity": merged[product_id]} for product_id in order]


def _lock_products(product_ids):
    stmt = select(Product).where(Product.id.in_(product_ids))
    if db.engine.dialect.name in {"mysql", "mariadb"}:
        stmt = stmt.with_for_update()
    return db.session.scalars(stmt).all()


def _adjust_stock(order, direction):
    items = db.session.scalars(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    for item in items:
        product = _lock_one(item.product_id)
        if product is None:
            continue
        if direction == "increment":
            product.stock = int(product.stock) + int(item.quantity)
        else:
            product.stock = max(0, int(product.stock) - int(item.quantity))


def _lock_one(product_id):
    stmt = select(Product).where(Product.id == product_id)
    if db.engine.dialect.name in {"mysql", "mariadb"}:
        stmt = stmt.with_for_update()
    return db.session.scalars(stmt).first()


def _assert_owner(order, user):
    if user.role == "admin":
        return order
    if int(order.user_id) != int(user.id):
        raise ApiError(403, "This action is unauthorized")
    return order


def _with_includes(stmt, include):
    if "items" in include or "items.product" in include:
        option = selectinload(Order.items)
        if "items.product" in include:
            option = option.selectinload(OrderItem.product)
        stmt = stmt.options(option)
    if "user" in include:
        stmt = stmt.options(selectinload(Order.user))
    return stmt


def _reload(order_id, include):
    stmt = _with_includes(select(Order).where(Order.id == order_id), include)
    return db.session.scalars(stmt).unique().one()
