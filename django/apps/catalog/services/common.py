from django.db import IntegrityError
from django.db.models.deletion import RestrictedError

from apps.core.exceptions import ApiError
from apps.core.slugify import slugify
from apps.core.validate import add_slug, add_string, raise_if_errors, require_dict


def _get(model, pk, label):
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise ApiError.not_found(f'{label} not found')
    return obj


def _ensure_slug(model, slug, exclude_id=None):
    queryset = model.objects.filter(slug=slug)
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    if queryset.exists():
        raise ApiError.conflict(f'Slug "{slug}" has already been taken')


def _destroy(obj):
    try:
        obj.delete()
    except (RestrictedError, IntegrityError) as exc:
        raise ApiError.conflict('Resource is still referenced by other records') from exc


def _read_description(data, errors):
    if 'description' not in data:
        return False, None
    value = data.get('description')
    if value is None or value is False or value == '':
        return True, None
    if not isinstance(value, str):
        errors['description'] = ['Description must be a string.']
        return True, None
    return True, value.strip()


def _validate_named(data, *, partial, name_max, slug_max):
    data = require_dict(data)
    errors = {}
    cleaned = {}
    name = add_string(errors, data, 'name', label='Name', min_len=2, max_len=name_max, required=not partial)
    if name is not None:
        cleaned['name'] = name
    slug = add_slug(errors, data, max_len=slug_max)
    if slug is not None:
        cleaned['slug'] = slug
    present, description = _read_description(data, errors)
    if present and 'description' not in errors:
        cleaned['description'] = description
    raise_if_errors(errors)
    return cleaned


def _assign_slug(model, instance, cleaned, name, partial):
    if partial:
        if 'slug' not in cleaned:
            return
        slug = slugify(cleaned['slug'])
    else:
        slug = slugify(cleaned['slug']) if cleaned.get('slug') else slugify(name)
    if not slug:
        raise ApiError.unprocessable('Validation failed', {'slug': ['Slug must be between 1 and 120 characters.']})
    _ensure_slug(model, slug, exclude_id=None if instance is None else instance.pk)
    return slug

