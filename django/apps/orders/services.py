from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch

from apps.catalog.models import Product
from apps.core.exceptions import ApiError
from apps.core.listing import apply_sort, paginate, parse_includes, parse_list_query, raise_if_errors
from apps.core.validate import add_order_items, add_status, optional_positive_query, parse_pk, require_dict
from apps.orders.models import ORDER_STATUSES, Order, OrderItem
from apps.orders.serializers import serialize_order

SORTABLE = ['id', 'status', 'total', 'user_id', 'created_at', 'updated_at']
INCLUDES = ['items', 'items.product', 'user']


def _with_includes(queryset, includes):
    includes = set(includes or [])
    if 'user' in includes:
        queryset = queryset.select_related('user')
    if 'items' in includes or 'items.product' in includes:
        item_queryset = OrderItem.objects.order_by('id')
        if 'items.product' in includes:
            item_queryset = item_queryset.select_related('product')
        queryset = queryset.prefetch_related(Prefetch('items', queryset=item_queryset))
    return queryset


def _get_order(pk):
    order = Order.objects.filter(pk=pk).first()
    if order is None:
        raise ApiError.not_found('Order not found')
    return order


def _assert_owner(order, user):
    if user.role == 'admin':
        return
    if order.user_id != user.id:
        raise ApiError.forbidden('This action is unauthorized')


def _merge_items(items):
    merged = {}
    order_ids = []
    for item in items:
        product_id = item['product_id']
        if product_id in merged:
            merged[product_id] += item['quantity']
        else:
            merged[product_id] = item['quantity']
            order_ids.append(product_id)
    return [{'product_id': product_id, 'quantity': merged[product_id]} for product_id in order_ids]


def _adjust_stock(order, direction):
    for item in OrderItem.objects.filter(order=order):
        product = Product.objects.select_for_update().filter(pk=item.product_id).first()
        if product is None:
            continue
        product.stock = max(0, product.stock + (item.quantity * direction))
        product.save(update_fields=['stock', 'updated_at'])


def list_orders(params, user):
    errors = {}
    query = parse_list_query(params, SORTABLE, INCLUDES, errors)
    status = None
    if 'status' in params and params.get('status') not in (None, ''):
        raw = params.get('status')
        if raw not in ORDER_STATUSES:
            errors['status'] = [f"Status must be one of: {', '.join(ORDER_STATUSES)}."]
        else:
            status = raw
    user_filter = optional_positive_query(errors, params, 'user_id')
    user_filter_sent = 'user_id' in params and params.get('user_id') not in (None, '')
    raise_if_errors(errors)
    if user_filter_sent and user.role != 'admin':
        raise ApiError.forbidden('The user_id filter is only available to administrators')

    queryset = Order.objects.all()
    if user.role == 'admin':
        if user_filter is not None:
            queryset = queryset.filter(user_id=user_filter)
    else:
        queryset = queryset.filter(user_id=user.id)
    if status is not None:
        queryset = queryset.filter(status=status)
    queryset = _with_includes(queryset, query.includes)
    queryset = apply_sort(queryset, query)
    rows, meta = paginate(queryset, query)
    return [serialize_order(row, query.includes) for row in rows], meta


def get_order(pk, user, params):
    errors = {}
    includes = parse_includes(params, INCLUDES, errors)
    raise_if_errors(errors)
    order = _with_includes(Order.objects.all(), includes).filter(pk=pk).first()
    if order is None:
        raise ApiError.not_found('Order not found')
    _assert_owner(order, user)
    return serialize_order(order, includes)


@transaction.atomic
def create_order(user, data):
    require_dict(data)
    errors = {}
    items = add_order_items(errors, data)
    raise_if_errors(errors)
    items = _merge_items(items)
    product_ids = [item['product_id'] for item in items]
    locked = Product.objects.select_for_update().filter(id__in=product_ids)
    products = {product.id: product for product in locked}
    missing = [product_id for product_id in product_ids if product_id not in products]
    if missing:
        raise ApiError.not_found(f'Product with id {missing[0]} not found')

    for item in items:
        product = products[item['product_id']]
        if product.stock < item['quantity']:
            raise ApiError.conflict(f'Insufficient stock for product "{product.name}"')

    order = Order.objects.create(user=user, status='pending', total=Decimal('0.00'))
    total = Decimal('0.00')
    for item in items:
        product = products[item['product_id']]
        line = (Decimal(product.price) * item['quantity']).quantize(Decimal('0.01'))
        total += line
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=item['quantity'],
            price=product.price,
        )
        product.stock -= item['quantity']
        product.save(update_fields=['stock', 'updated_at'])

    order.total = total.quantize(Decimal('0.01'))
    order.save(update_fields=['total', 'updated_at'])
    loaded = _with_includes(Order.objects.all(), ['items', 'items.product']).get(pk=order.pk)
    return serialize_order(loaded, ['items', 'items.product'])


@transaction.atomic
def update_status(pk, data, user):
    pk = parse_pk(pk) if not isinstance(pk, int) else pk
    errors = {}
    status = add_status(errors, require_dict(data))
    raise_if_errors(errors)
    order = Order.objects.select_for_update().filter(pk=pk).first()
    if order is None:
        raise ApiError.not_found('Order not found')
    _assert_owner(order, user)
    if order.status == status:
        return serialize_order(order, [])
    if user.role != 'admin' and not (order.status == 'pending' and status == 'cancelled'):
        raise ApiError.forbidden('This action is unauthorized')
    if order.status != 'cancelled' and status == 'cancelled':
        _adjust_stock(order, 1)
    elif order.status == 'cancelled' and status != 'cancelled':
        _adjust_stock(order, -1)
    order.status = status
    order.save(update_fields=['status', 'updated_at'])
    order.refresh_from_db()
    return serialize_order(order, [])


@transaction.atomic
def delete_order(pk, user):
    if user.role != 'admin':
        raise ApiError.forbidden('This action is unauthorized')
    order = Order.objects.select_for_update().filter(pk=pk).first()
    if order is None:
        raise ApiError.not_found('Order not found')
    if order.status != 'cancelled':
        _adjust_stock(order, 1)
    order.delete()
