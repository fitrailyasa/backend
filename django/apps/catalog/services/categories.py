from django.db.models import Prefetch

from apps.catalog.models import Category, Product
from apps.catalog.serializers import serialize_category
from apps.catalog.services.common import _assign_slug, _destroy, _get, _validate_named
from apps.core.listing import apply_search, apply_sort, paginate, parse_includes, parse_list_query, raise_if_errors

CATEGORY_SORTABLE = ['id', 'name', 'slug', 'created_at', 'updated_at']


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
