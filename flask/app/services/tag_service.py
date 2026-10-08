"""Tag queries and writes."""

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.common.pagination import apply_sort, build_meta, count_stmt
from app.extensions import db
from app.models.tag import Tag
from app.services.helpers import get_or_404, resolve_slug

SORTABLE = {"id", "name", "slug", "created_at", "updated_at"}
SLUG_MAX = 80


def list_tags(params):
    stmt = select(Tag)
    search = params.get("search")
    if search:
        stmt = stmt.where(Tag.name.ilike(f"%{search}%"))
    total = count_stmt(stmt)
    stmt = apply_sort(stmt, Tag, params.get("sort"), params.get("order"), SORTABLE)
    if "products" in params.get("include", []):
        stmt = stmt.options(selectinload(Tag.products))
    offset = (params["page"] - 1) * params["limit"]
    rows = db.session.scalars(stmt.offset(offset).limit(params["limit"])).unique().all()
    return rows, build_meta(total, params["page"], params["limit"])


def get_tag(tag_id):
    return get_or_404(Tag, tag_id, "Tag")


def create_tag(payload):
    slug = resolve_slug(Tag, payload, max_length=SLUG_MAX, creating=True)
    tag = Tag(name=payload["name"].strip(), slug=slug)
    db.session.add(tag)
    db.session.commit()
    db.session.refresh(tag)
    return tag


def update_tag(tag_id, payload):
    tag = get_tag(tag_id)
    if payload.get("name"):
        tag.name = payload["name"].strip()
    slug = resolve_slug(Tag, payload, max_length=SLUG_MAX, exclude_id=tag.id, creating=False)
    if slug:
        tag.slug = slug
    db.session.commit()
    db.session.refresh(tag)
    return tag


def delete_tag(tag_id):
    tag = get_tag(tag_id)
    db.session.delete(tag)
    db.session.commit()
