from apps.accounts.serializers import serialize_user
from apps.catalog.serializers import serialize_product
from apps.core.formatting import iso, money


def serialize_order_item(item, *, product=False):
    data = {
        'id': item.id,
        'order_id': item.order_id,
        'product_id': item.product_id,
        'quantity': item.quantity,
        'price': money(item.price),
        'created_at': iso(item.created_at),
        'updated_at': iso(item.updated_at),
    }
    if product:
        data['product'] = serialize_product(item.product)
    return data


def serialize_order(order, includes):
    data = {
        'id': order.id,
        'user_id': order.user_id,
        'status': order.status,
        'total': money(order.total),
        'created_at': iso(order.created_at),
        'updated_at': iso(order.updated_at),
    }
    includes = set(includes or [])
    if 'items' in includes or 'items.product' in includes:
        cache = getattr(order, '_prefetched_objects_cache', {})
        rows = order.items.all()
        if 'items' not in cache:
            rows = rows.select_related('product').order_by('id') if 'items.product' in includes else rows.order_by('id')
        data['items'] = [
            serialize_order_item(item, product='items.product' in includes)
            for item in rows
        ]
    if 'user' in includes:
        data['user'] = serialize_user(order.user)
    return data
