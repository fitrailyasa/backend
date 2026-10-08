"""Product queries, filters, and writes."""

from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload, selectinload

from app.common.errors import ApiError
from app.common.pagination import apply_sort, build_meta, count_stmt
from app.common.slug import slugify
from app.extensions import db
from app.models.category import Category
from app.models.product import Product
from app.models.tag import Tag
from app.services.helpers import get_or_404, resolve_slug

SORTABLE = {"id", "name", "slug", "price", "stock", "category_id", "created_at", "updated_at"}
SLUG_MAX = 180


def list_products(params):
    stmt = select(Product)
    search = params.get("search")
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Product.name.ilike(pattern), Product.description.ilike(pattern)))
    if params.get("category_id") is not None:
        stmt = stmt.where(Product.category_id == params["category_id"])
    if params.get("min_price") is not None:
        stmt = stmt.where(Product.price >= Decimal(str(params["min_price"])))
    if params.get("max_price") is not None:
        stmt = stmt.where(Product.price <= Decimal(str(params["max_price"])))

    tag_filters = []
    if params.get("tag_id") is not None:
        tag_filters.append(Tag.id == params["tag_id"])
    if params.get("tag"):
        tag_filters.append(Tag.slug == slugify(params["tag"], 80))
    if tag_filters:
        matching_ids = select(Product.id).join(Product.tags).where(*tag_filters)
        stmt = stmt.where(Product.id.in_(matching_ids))

    total = count_stmt(stmt)
    stmt = apply_sort(stmt, Product, params.get("sort"), params.get("order"), SORTABLE)
    stmt = _with_includes(stmt, params.get("include", []))
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).unique().all()
    return rows, build_meta(total, params["page"], params["limit"])


def get_product(product_id, params=None):
    params = params or {}
    stmt = _with_includes(select(Product).where(Product.id == product_id), params.get("include", []))
    product = db.session.scalars(stmt).unique().first()
    if product is None:
        raise ApiError(404, "Product not found")
    return product


def create_product(payload):
    _assert_category(payload["category_id"])
    slug = resolve_slug(Product, payload, max_length=SLUG_MAX, creating=True)
    product = Product(
        category_id=payload["category_id"],
        name=payload["name"].strip(),
        slug=slug,
        description=payload.get("description") or None,
        price=Decimal(str(payload["price"])),
        stock=int(payload.get("stock", 0) or 0),
    )
    db.session.add(product)
    db.session.flush()
    if "tags" in payload:
        _set_tags(product, payload["tags"])
    db.session.commit()
    db.session.refresh(product)
    return product


def update_product(product_id, payload):
    product = get_or_404(Product, product_id, "Product")
    if payload.get("category_id") is not None:
        _assert_category(payload["category_id"])
        product.category_id = payload["category_id"]
    if payload.get("name"):
        product.name = payload["name"].strip()
    slug = resolve_slug(Product, payload, max_length=SLUG_MAX, exclude_id=product.id, creating=False)
    if slug:
        product.slug = slug
    if "description" in payload:
        product.description = payload.get("description") or None
    if payload.get("price") is not None:
        product.price = Decimal(str(payload["price"]))
    if payload.get("stock") is not None:
        product.stock = int(payload["stock"])
    if "tags" in payload:
        _set_tags(product, payload["tags"])
    db.session.commit()
    db.session.refresh(product)
    return product


def delete_product(product_id):
    product = get_or_404(Product, product_id, "Product")
    db.session.delete(product)
    db.session.commit()


def _with_includes(stmt, include):
    if "category" in include:
        stmt = stmt.options(joinedload(Product.category))
    if "tags" in include:
        stmt = stmt.options(selectinload(Product.tags))
    return stmt


def _assert_category(category_id):
    if db.session.get(Category, category_id) is None:
        raise ApiError(422, "Validation failed", errors={"category_id": ["The selected category id is invalid."]})


def _set_tags(product, tag_ids):
    unique = []
    for tag_id in tag_ids or []:
        if tag_id not in unique:
            unique.append(tag_id)
    if not unique:
        product.tags = []
        return
    found = db.session.scalars(select(Tag).where(Tag.id.in_(unique))).all()
    if len(found) != len(unique):
        raise ApiError(422, "Validation failed", errors={"tags": ["One or more selected tags are invalid."]})
    by_id = {tag.id: tag for tag in found}
    product.tags = [by_id[tag_id] for tag_id in unique]
