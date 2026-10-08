from django.db import IntegrityError
from django.db.models import Prefetch
from django.db.models.deletion import RestrictedError

from apps.catalog.models import Category, Product, Tag
from apps.catalog.serializers import serialize_category, serialize_product, serialize_tag
from apps.core.exceptions import ApiError
from apps.core.listing import (
    apply_search,
    apply_sort,
    paginate,
    parse_includes,
    parse_list_query,
    raise_if_errors,
)
from apps.core.slugify import slugify
from apps.core.validate import (
    add_money,
    add_positive_int,
    add_slug,
    add_stock,
    add_string,
    add_tags,
    optional_money_query,
    optional_positive_query,
    require_dict,
)

CATEGORY_SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at']
PRODUCT_SORTABLE = ['id', 'name', 'slug', 'price', 'stock', 'category_id', 'created_at', 'updated_at']
TAG_SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at']


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


def list_categories(params):
    errors = {}
    query = parse_list_query(params, CATEGORY_SORTABLE, ['products'], errors)
    raise_if_errors(errors)
    queryset = apply_search(Category.objects.all(), query.search, ['name', 'description'])
    if 'products' in query.includes:
        queryset = queryset.prefetch_related(Prefetch('products', queryset=Product.objects.order_by('id')))
    queryset = apply_sort(queryset, query)
    rows, meta = paginate(queryset, query)
    return [serialize_category(row, products='products' in query.includes) for row in rows], meta


def get_category(pk, params):
    errors = {}
    includes = parse_includes(params, ['products'], errors)
    raise_if_errors(errors)
    category = _get(Category, pk, 'Category')
    if 'products' in includes:
        category = Category.objects.prefetch_related(
            Prefetch('products', queryset=Product.objects.order_by('id'))
        ).get(pk=category.pk)
    return serialize_category(category, products='products' in includes)


def create_category(data):
    cleaned = _validate_named(data, partial=False, name_max=100, slug_max=120)
    slug = _assign_slug(Category, None, cleaned, cleaned['name'], partial=False)
    category = Category.objects.create(
        name=cleaned['name'],
        slug=slug,
        description=cleaned.get('description'),
    )
    return serialize_category(category)


def update_category(pk, data, partial):
    category = _get(Category, pk, 'Category')
    cleaned = _validate_named(data, partial=partial, name_max=100, slug_max=120)
    if not partial or 'name' in cleaned:
        category.name = cleaned['name']
    slug = _assign_slug(Category, category, cleaned, category.name, partial=partial)
    if slug is not None:
        category.slug = slug
    if not partial:
        category.description = cleaned.get('description')
    elif 'description' in cleaned:
        category.description = cleaned['description']
    category.save()
    return serialize_category(category)


def delete_category(pk):
    _destroy(_get(Category, pk, 'Category'))


def _tag_filters(params, errors):
    tag_id = optional_positive_query(errors, params, 'tag_id')
    tag_slug = None
    if 'tag' in params and params.get('tag') not in (None, ''):
        raw = params.get('tag')
        if not isinstance(raw, str):
            errors['tag'] = ['tag must be a string.']
        else:
            tag_slug = slugify(raw.strip()) or None
    return tag_id, tag_slug


def _product_queryset(includes, tag_id, tag_slug):
    queryset = Product.objects.all()
    if 'category' in includes:
        queryset = queryset.select_related('category')
    filtering = tag_id is not None or tag_slug is not None
    if filtering:
        tags = Tag.objects.all()
        if tag_id is not None:
            tags = tags.filter(pk=tag_id)
        if tag_slug is not None:
            tags = tags.filter(slug=tag_slug)
        queryset = queryset.filter(tags__in=tags).distinct()
    if 'tags' in includes or filtering:
        prefetch = Tag.objects.all().order_by('id')
        if tag_id is not None:
            prefetch = prefetch.filter(pk=tag_id)
        if tag_slug is not None:
            prefetch = prefetch.filter(slug=tag_slug)
        queryset = queryset.prefetch_related(Prefetch('tags', queryset=prefetch))
    return queryset, 'tags' in includes or filtering


def list_products(params):
    errors = {}
    query = parse_list_query(params, PRODUCT_SORTABLE, ['category', 'tags'], errors)
    category_id = optional_positive_query(errors, params, 'category_id')
    min_price = optional_money_query(errors, params, 'min_price')
    max_price = optional_money_query(errors, params, 'max_price')
    tag_id, tag_slug = _tag_filters(params, errors)
    raise_if_errors(errors)

    queryset, with_tags = _product_queryset(query.includes, tag_id, tag_slug)
    queryset = apply_search(queryset, query.search, ['name', 'description'])
    if category_id is not None:
        queryset = queryset.filter(category_id=category_id)
    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)
    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)
    queryset = apply_sort(queryset, query)
    rows, meta = paginate(queryset, query)
    data = [
        serialize_product(row, category='category' in query.includes, tags=with_tags)
        for row in rows
    ]
    return data, meta


def get_product(pk, params):
    errors = {}
    includes = parse_includes(params, ['category', 'tags'], errors)
    tag_id, tag_slug = _tag_filters(params, errors)
    raise_if_errors(errors)
    queryset, with_tags = _product_queryset(includes, tag_id, tag_slug)
    product = queryset.filter(pk=pk).first()
    if product is None:
        raise ApiError.not_found('Product not found')
    return serialize_product(product, category='category' in includes, tags=with_tags)


def _validate_product(data, partial):
    data = require_dict(data)
    errors = {}
    cleaned = {}
    category_id = add_positive_int(errors, data, 'category_id', required=not partial, label='category_id')
    if category_id is not None:
        cleaned['category_id'] = category_id
    name = add_string(errors, data, 'name', label='Name', min_len=2, max_len=150, required=not partial)
    if name is not None:
        cleaned['name'] = name
    slug = add_slug(errors, data, max_len=180)
    if slug is not None:
        cleaned['slug'] = slug
    present, description = _read_description(data, errors)
    if present and 'description' not in errors:
        cleaned['description'] = description
    price = add_money(errors, data, 'price', required=not partial, label='Price')
    if price is not None:
        cleaned['price'] = price
    if 'stock' in data and data.get('stock') not in (None, ''):
        stock = add_stock(errors, data)
        if stock is not None:
            cleaned['stock'] = stock
    elif not partial and 'stock' not in data:
        pass
    tags = add_tags(errors, data)
    if tags is not None:
        cleaned['tags'] = tags
    raise_if_errors(errors)
    return cleaned


def _assert_category(category_id):
    if not Category.objects.filter(pk=category_id).exists():
        raise ApiError.unprocessable('Validation failed', {'category_id': ['The selected category id is invalid.']})


def _resolve_tags(tag_ids):
    unique = list(dict.fromkeys(tag_ids))
    found = list(Tag.objects.filter(pk__in=unique))
    if len(found) != len(unique):
        raise ApiError.unprocessable('Validation failed', {'tags': ['One or more selected tags are invalid.']})
    return found


def create_product(data):
    cleaned = _validate_product(data, partial=False)
    _assert_category(cleaned['category_id'])
    slug = _assign_slug(Product, None, cleaned, cleaned['name'], partial=False)
    product = Product.objects.create(
        category_id=cleaned['category_id'],
        name=cleaned['name'],
        slug=slug,
        description=cleaned.get('description'),
        price=cleaned['price'],
        stock=cleaned.get('stock', 0),
    )
    if 'tags' in cleaned:
        product.tags.set(_resolve_tags(cleaned['tags']))
    return serialize_product(product)


def update_product(pk, data, partial):
    product = _get(Product, pk, 'Product')
    cleaned = _validate_product(data, partial=partial)
    if 'category_id' in cleaned:
        _assert_category(cleaned['category_id'])
        product.category_id = cleaned['category_id']
    if not partial or 'name' in cleaned:
        product.name = cleaned['name']
    slug = _assign_slug(Product, product, cleaned, product.name, partial=partial)
    if slug is not None:
        product.slug = slug
    if not partial:
        product.description = cleaned.get('description')
        product.price = cleaned['price']
        product.stock = cleaned.get('stock', 0)
    else:
        if 'description' in cleaned:
            product.description = cleaned['description']
        if 'price' in cleaned:
            product.price = cleaned['price']
        if 'stock' in cleaned:
            product.stock = cleaned['stock']
    product.save()
    if not partial:
        product.tags.set(_resolve_tags(cleaned['tags']) if 'tags' in cleaned else [])
    elif 'tags' in cleaned:
        product.tags.set(_resolve_tags(cleaned['tags']))
    return serialize_product(product)


def delete_product(pk):
    _destroy(_get(Product, pk, 'Product'))


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
