"""Tag routes."""

from flask import Blueprint

from app.common.auth import authorize
from app.common.requests import json_body, path_id, query_dict
from app.common.responses import created, ok, paginated
from app.common.serialize import dump_tag
from app.schemas.common import parse
from app.schemas.tag import TagListQuerySchema, TagUpdateSchema, TagWriteSchema
from app.services import tag_service

bp = Blueprint("tags", __name__, url_prefix="/tags")


@bp.get("/")
def index():
    params = parse(TagListQuerySchema, query_dict())
    rows, meta = tag_service.list_tags(params)
    return paginated("Tags retrieved", [dump_tag(row, include_products=True) for row in rows], meta)


@bp.get("/<tag_id>")
def show(tag_id):
    tag = tag_service.get_tag(path_id(tag_id))
    return ok("Tag retrieved", dump_tag(tag))


@bp.post("/")
@authorize("admin")
def store():
    payload = parse(TagWriteSchema, json_body())
    tag = tag_service.create_tag(payload)
    return created("Tag created successfully", dump_tag(tag))


@bp.put("/<tag_id>")
@authorize("admin")
def replace(tag_id):
    record_id = path_id(tag_id)
    payload = parse(TagWriteSchema, json_body())
    tag = tag_service.update_tag(record_id, payload)
    return ok("Tag updated successfully", dump_tag(tag))


@bp.patch("/<tag_id>")
@authorize("admin")
def update(tag_id):
    record_id = path_id(tag_id)
    payload = parse(TagUpdateSchema, json_body(), partial=True)
    tag = tag_service.update_tag(record_id, payload)
    return ok("Tag updated successfully", dump_tag(tag))


@bp.delete("/<tag_id>")
@authorize("admin")
def destroy(tag_id):
    tag_service.delete_tag(path_id(tag_id))
    return ok("Tag deleted successfully", None)
