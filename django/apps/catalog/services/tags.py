from apps.catalog.models import Tag
from apps.catalog.serializers import serialize_tag
from apps.catalog.services.common import _assign_slug, _destroy, _get, _validate_named
from apps.core.listing import apply_search, apply_sort, paginate, parse_list_query, raise_if_errors

TAG_SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at']


def list_tags(params):
    errors = {}
    query = parse_list_query(params, TAG_SORTABLE, errors=errors)
    raise_if_errors(errors)
    queryset = apply_sort(apply_search(Tag.objects.all(), query.search, ['name']), query)
    rows, meta = paginate(queryset, query)
    return [serialize_tag(row) for row in rows], meta


def get_tag(pk):
    return serialize_tag(_get(Tag, pk, 'Tag'))


def create_tag(data):
    cleaned = _validate_named(data, partial=False, name_max=60, slug_max=80)
    slug = _assign_slug(Tag, None, cleaned, cleaned['name'], partial=False)
    tag = Tag.objects.create(name=cleaned['name'], slug=slug)
    return serialize_tag(tag)


def update_tag(pk, data, partial):
    tag = _get(Tag, pk, 'Tag')
    cleaned = _validate_named(data, partial=partial, name_max=60, slug_max=80)
    if not partial or 'name' in cleaned:
        tag.name = cleaned['name']
    slug = _assign_slug(Tag, tag, cleaned, tag.name, partial=partial)
    if slug is not None:
        tag.slug = slug
    tag.save()
    return serialize_tag(tag)


def delete_tag(pk):
    _destroy(_get(Tag, pk, 'Tag'))
