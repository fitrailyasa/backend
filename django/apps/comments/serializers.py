from apps.accounts.serializers import serialize_user
from apps.catalog.serializers import serialize_product
from apps.core.formatting import iso


def serialize_comment(comment, includes=None):
    includes = set(includes or [])
    data = {
        'id': comment.id,
        'product_id': comment.product_id,
        'user_id': comment.user_id,
        'body': comment.body,
        'created_at': iso(comment.created_at),
        'updated_at': iso(comment.updated_at),
    }
    if 'user' in includes:
        data['user'] = serialize_user(comment.user)
    if 'product' in includes:
        data['product'] = serialize_product(comment.product)
    return data
