import math
from dataclasses import dataclass, field

from django.conf import settings

from apps.core.exceptions import ApiError


@dataclass
class ListQuery:
    page: int = 1
    limit: int = 10
    search: str | None = None
    sort: str = 'id'
    order: str = 'desc'
    includes: list[str] = field(default_factory=list)


def _present(params, key):
    if key not in params:
        return False
    value = params.get(key)
    return value is not None and str(value) != ''


def parse_list_query(params, sortable, include_allowed=None, errors=None):
    if errors is None:
        errors = {}
    page = 1
    limit = settings.PAGINATION_LIMIT
    max_limit = settings.PAGINATION_MAX_LIMIT

    if _present(params, 'page'):
        raw = str(params.get('page')).strip()
        if not raw.isdigit() or not 1 <= int(raw) <= 100000:
            errors['page'] = ['Page must be a positive integer.']
        else:
            page = int(raw)

    if _present(params, 'limit'):
        raw = str(params.get('limit')).strip()
        if not raw.isdigit() or not 1 <= int(raw) <= max_limit:
            errors['limit'] = [f'Limit must be an integer between 1 and {max_limit}.']
        else:
            limit = int(raw)

    search = None
    if _present(params, 'search'):
        raw = str(params.get('search')).strip()
        if len(raw) > 150:
            errors['search'] = ['Search must be at most 150 characters.']
        else:
            search = raw or None

    sort = 'id' if 'id' in sortable else sortable[0]
    if _present(params, 'sort'):
        raw = str(params.get('sort')).strip()
        if raw in sortable:
            sort = raw
        else:
            errors['sort'] = [f"Sort must be one of: {', '.join(sortable)}."]

    order = 'desc'
    if _present(params, 'order'):
        raw = str(params.get('order')).strip().lower()
        if raw not in {'asc', 'desc'}:
            errors['order'] = ['Order must be either asc or desc.']
        else:
            order = raw

    includes = []
    if include_allowed is not None and _present(params, 'include'):
        raw = str(params.get('include'))
        entries = [entry.strip() for entry in raw.split(',') if entry.strip()]
        invalid = [entry for entry in entries if entry not in include_allowed]
        if invalid:
            allowed = ', '.join(include_allowed)
            errors['include'] = [
                f"Unsupported include value(s): {', '.join(invalid)}. Allowed: {allowed}."
            ]
        else:
            includes = entries

    return ListQuery(page=page, limit=limit, search=search, sort=sort, order=order, includes=includes)


def raise_if_errors(errors):
    if errors:
        raise ApiError.unprocessable('Validation failed', errors)


def apply_search(queryset, term, fields):
    if not term or not fields:
        return queryset
    from django.db.models import Q

    query = Q()
    for name in fields:
        query |= Q(**{f'{name}__icontains': term})
    return queryset.filter(query)


def apply_sort(queryset, query: ListQuery):
    prefix = '' if query.order == 'asc' else '-'
    if query.sort == 'id':
        return queryset.order_by(f'{prefix}id')
    return queryset.order_by(f'{prefix}{query.sort}', 'id')


def parse_includes(params, allowed, errors):
    if 'include' not in params or params.get('include') in (None, ''):
        return []
    entries = [entry.strip() for entry in str(params.get('include')).split(',') if entry.strip()]
    invalid = [entry for entry in entries if entry not in allowed]
    if invalid:
        errors['include'] = [
            f"Unsupported include value(s): {', '.join(invalid)}. Allowed: {', '.join(allowed)}."
        ]
        return []
    return entries


def paginate(queryset, query: ListQuery):
    total = queryset.count()
    start = (query.page - 1) * query.limit
    rows = list(queryset[start:start + query.limit])
    total_pages = math.ceil(total / query.limit) if query.limit else 0
    meta = {
        'page': int(query.page),
        'limit': int(query.limit),
        'total': int(total),
        'total_pages': int(total_pages),
    }
    return rows, meta
