"""Small persistence helpers shared by services."""

from sqlalchemy import select

from app.common.errors import ApiError
from app.common.slug import slugify
from app.extensions import db


def get_or_404(model, record_id, label):
    record = db.session.get(model, record_id)
    if record is None:
        raise ApiError(404, f"{label} not found")
    return record


def ensure_unique_slug(model, slug, exclude_id=None):
    stmt = select(model.id).where(model.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    if db.session.scalar(stmt):
        raise ApiError(409, f'Slug "{slug}" has already been taken')
    return slug


def resolve_slug(model, payload, *, max_length, exclude_id=None, creating=False):
    if creating or ("slug" in payload and payload.get("slug")):
        source = payload.get("slug") or payload.get("name")
        slug = slugify(source, max_length)
        if not slug:
            raise ApiError(422, "Validation failed", errors={"name": ["Name must produce a valid slug."]})
        return ensure_unique_slug(model, slug, exclude_id=exclude_id)
    return None
