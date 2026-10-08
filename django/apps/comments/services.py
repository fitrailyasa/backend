from apps.catalog.models import Product
from apps.comments.models import Comment
from apps.comments.serializers import serialize_comment
from apps.core.exceptions import ApiError
from apps.core.listing import apply_search, apply_sort, paginate, parse_includes, parse_list_query, raise_if_errors
from apps.core.validate import optional_positive_query, parse_pk, require_dict

SORTABLE = ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at']
INCLUDES = ['user', 'product']


def _validate_body(data):
    data = require_dict(data)
    errors = {}
    if 'body' not in data or data.get('body') is None or data.get('body') is False or data.get('body') == '':
        errors['body'] = ['Body is required.']
        text = None
    elif not isinstance(data.get('body'), str):
        errors['body'] = ['Body must be a string.']
        text = None
    else:
        text = data['body'].strip()
        if not 1 <= len(text) <= 2000:
            errors['body'] = ['Body must be between 1 and 2000 characters.']
            text = None
    raise_if_errors(errors)
    return text


def _apply_includes(queryset, includes):
    if 'user' in includes:
        queryset = queryset.select_related('user')
    if 'product' in includes:
        queryset = queryset.select_related('product')
    return queryset


def _assert_product(product_id):
    if not Product.objects.filter(pk=product_id).exists():
        raise ApiError.not_found(f'Product with id {product_id} not found')


def _get_comment(pk):
    comment = Comment.objects.filter(pk=pk).first()
    if comment is None:
        raise ApiError.not_found('Comment not found')
    return comment


def _assert_owner(comment, user):
    if user.role == 'admin':
        return
    if comment.user_id != user.id:
        raise ApiError.forbidden('This action is unauthorized')


def list_comments(params, product_id=None):
    if product_id is not None:
        product_id = parse_pk(product_id, 'productId')
        _assert_product(product_id)
    errors = {}
    query = parse_list_query(params, SORTABLE, INCLUDES, errors)
    filter_product = optional_positive_query(errors, params, 'product_id')
    filter_user = optional_positive_query(errors, params, 'user_id')
    raise_if_errors(errors)

    queryset = Comment.objects.all()
    queryset = apply_search(queryset, query.search, ['body'])
    if product_id is not None:
        queryset = queryset.filter(product_id=product_id)
    elif filter_product is not None:
        queryset = queryset.filter(product_id=filter_product)
    if filter_user is not None:
        queryset = queryset.filter(user_id=filter_user)
    queryset = _apply_includes(queryset, query.includes)
    queryset = apply_sort(queryset, query)
    rows, meta = paginate(queryset, query)
    return [serialize_comment(row, query.includes) for row in rows], meta


def create_comment(product_id, data, user):
    product_id = parse_pk(product_id, 'productId')
    _assert_product(product_id)
    body = _validate_body(data)
    comment = Comment.objects.create(product_id=product_id, user=user, body=body)
    return serialize_comment(comment)


def update_comment(pk, data, user):
    comment = _get_comment(parse_pk(pk))
    _assert_owner(comment, user)
    comment.body = _validate_body(data)
    comment.save()
    return serialize_comment(comment)


def delete_comment(pk, user):
    comment = _get_comment(parse_pk(pk))
    _assert_owner(comment, user)
    comment.delete()
