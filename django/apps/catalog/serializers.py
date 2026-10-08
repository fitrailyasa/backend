from apps.core.formatting import iso, money


def _cached(instance, relation):
    cache = getattr(instance, '_prefetched_objects_cache', {})
    return relation in cache


def serialize_tag(tag):
    return {
        'id': tag.id,
        'name': tag.name,
        'slug': tag.slug,
        'created_at': iso(tag.created_at),
        'updated_at': iso(tag.updated_at),
    }


def serialize_category(category, *, products=False):
    data = {
        'id': category.id,
        'name': category.name,
        'slug': category.slug,
        'description': category.description,
        'created_at': iso(category.created_at),
        'updated_at': iso(category.updated_at),
    }
    if products:
        rows = category.products.all()
        if not _cached(category, 'products'):
            rows = rows.order_by('id')
        data['products'] = [serialize_product(product) for product in rows]
    return data


def serialize_product(product, *, category=False, tags=False):
    data = {
        'id': product.id,
        'category_id': product.category_id,
        'name': product.name,
        'slug': product.slug,
        'description': product.description,
        'price': money(product.price),
        'stock': product.stock,
        'created_at': iso(product.created_at),
        'updated_at': iso(product.updated_at),
    }
    if category:
        data['category'] = serialize_category(product.category)
    if tags:
        rows = product.tags.all()
        if not _cached(product, 'tags'):
            rows = rows.order_by('id')
        data['tags'] = [serialize_tag(tag) for tag in rows]
    return data
