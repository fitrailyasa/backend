"""Category queries and writes."""

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.common.pagination import apply_sort, build_meta, count_stmt
from app.extensions import db
from app.models.category import Category
from app.services.helpers import get_or_404, resolve_slug

SORTABLE = {"id", "name", "slug", "created_at", "updated_at"}
SLUG_MAX = 120


def list_categories(params):
    stmt = select(Category)
    search = params.get("search")
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Category.name.ilike(pattern), Category.description.ilike(pattern)))
    total = count_stmt(stmt)
    stmt = apply_sort(stmt, Category, params.get("sort"), params.get("order"), SORTABLE)
    if "products" in params.get("include", []):
        stmt = stmt.options(selectinload(Category.products))
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).unique().all()
    return rows, build_meta(total, params["page"], params["limit"])


def get_category(category_id, params=None):
    params = params or {}
    stmt = select(Category).where(Category.id == category_id)
    if "products" in params.get("include", []):
        stmt = stmt.options(selectinload(Category.products))
    category = db.session.scalars(stmt).unique().first()
    if category is None:
        from app.common.errors import ApiError

        raise ApiError(404, "Category not found")
    return category


def create_category(payload):
    slug = resolve_slug(Category, payload, max_length=SLUG_MAX, creating=True)
    category = Category(name=payload["name"].strip(), slug=slug, description=_description(payload))
    db.session.add(category)
    db.session.commit()
    db.session.refresh(category)
    return category


def update_category(category_id, payload):
    category = get_or_404(Category, category_id, "Category")
    if payload.get("name"):
        category.name = payload["name"].strip()
    slug = resolve_slug(Category, payload, max_length=SLUG_MAX, exclude_id=category.id, creating=False)
    if slug:
        category.slug = slug
    if "description" in payload:
        category.description = _description(payload)
    db.session.commit()
    db.session.refresh(category)
    return category


def delete_category(category_id):
    category = get_or_404(Category, category_id, "Category")
    db.session.delete(category)
    db.session.commit()


def _description(payload):
    if "description" not in payload or payload["description"] in (None, ""):
        return None
    return payload["description"]
