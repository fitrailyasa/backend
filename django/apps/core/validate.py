import re
from decimal import Decimal

SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
ORDER_STATUSES = ('pending', 'paid', 'shipped', 'completed', 'cancelled')
ROLES = ('user', 'admin')


def is_blank(value):
    return value is None or value is False or value == '' or value == 0


def require_dict(data):
    from apps.core.exceptions import ApiError

    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ApiError.bad_request('Invalid JSON payload')
    return data


def parse_pk(value, name='id'):
    from apps.core.exceptions import ApiError

    text = str(value).strip()
    if not text.isdigit() or int(text) < 1:
        raise ApiError.unprocessable('Validation failed', {name: [f'{name} must be a positive integer.']})
    return int(text)


def add_string(errors, data, field, *, label, min_len, max_len, required):
    if field not in data or is_blank(data.get(field)):
        if required:
            errors.setdefault(field, [f'{label} is required.'])
        return None
    value = data.get(field)
    if not isinstance(value, str):
        errors.setdefault(field, [f'{label} must be a string.'])
        return None
    trimmed = value.strip()
    if len(trimmed) < min_len or len(trimmed) > max_len:
        errors.setdefault(field, [f'{label} must be between {min_len} and {max_len} characters.'])
        return None
    return trimmed


def add_email(errors, data, *, required):
    if 'email' not in data or is_blank(data.get('email')):
        if required:
            errors.setdefault('email', ['Email is required.'])
        return None
    value = data.get('email')
    if not isinstance(value, str):
        errors.setdefault('email', ['Email must be a string.'])
        return None
    trimmed = value.strip()
    if len(trimmed) < 3 or len(trimmed) > 150:
        errors.setdefault('email', ['Email must be between 3 and 150 characters.'])
        return None
    if not EMAIL_RE.match(trimmed):
        errors.setdefault('email', ['The email must be a valid email address.'])
        return None
    return trimmed.lower()


def add_password(errors, data, *, required, confirm=False):
    if 'password' not in data or is_blank(data.get('password')):
        if required:
            errors.setdefault('password', ['Password is required.'])
        password = None
    else:
        value = data.get('password')
        if not isinstance(value, str):
            errors.setdefault('password', ['Password must be a string.'])
            password = None
        elif len(value) < 8 or len(value) > 72:
            errors.setdefault('password', ['Password must be at least 8 characters long.'])
            password = None
        else:
            password = value

    if confirm:
        if 'password_confirmation' not in data or is_blank(data.get('password_confirmation')):
            errors.setdefault('password_confirmation', ['password_confirmation is required.'])
        elif not isinstance(data.get('password_confirmation'), str) or data.get('password_confirmation') != data.get('password'):
            errors.setdefault('password_confirmation', ['password_confirmation must match password.'])
    return password


def add_slug(errors, data, *, max_len):
    if 'slug' not in data or is_blank(data.get('slug')):
        return None
    value = data.get('slug')
    if not isinstance(value, str):
        errors.setdefault('slug', ['Slug must be a string.'])
        return None
    trimmed = value.strip()
    if len(trimmed) < 1 or len(trimmed) > max_len:
        errors.setdefault('slug', [f'Slug must be between 1 and {max_len} characters.'])
        return None
    if not SLUG_RE.match(trimmed):
        errors.setdefault('slug', ['Slug may only contain lowercase letters, numbers and single hyphens.'])
        return None
    return trimmed


def add_description(errors, data):
    if 'description' not in data or data.get('description') is None or data.get('description') is False or data.get('description') == '':
        if 'description' in data:
            return None
        return None
    value = data.get('description')
    if not isinstance(value, str):
        errors.setdefault('description', ['Description must be a string.'])
        return None
    return value.strip()


def description_provided(data):
    return 'description' in data


def add_role(errors, data):
    if 'role' not in data or data.get('role') is None or data.get('role') == '':
        return None
    value = data.get('role')
    if not isinstance(value, str):
        errors.setdefault('role', ['Role must be a string.'])
        return None
    if value not in ROLES:
        errors.setdefault('role', [f"Role must be one of: {', '.join(ROLES)}."])
        return None
    return value


def _is_bool(value):
    return isinstance(value, bool)


def add_positive_int(errors, data, field, *, required, label=None):
    label = label or field
    if field not in data or data.get(field) is None or data.get(field) == '':
        if required:
            errors.setdefault(field, [f'{label} is required.'])
        return None
    value = data.get(field)
    parsed = _parse_positive_int(value)
    if parsed is None:
        errors.setdefault(field, [f'{label} must be a positive integer.'])
        return None
    return parsed


def _parse_positive_int(value):
    if _is_bool(value):
        return None
    if isinstance(value, int) and value >= 1:
        return value
    if isinstance(value, float) and value.is_integer() and value >= 1:
        return int(value)
    if isinstance(value, str) and value.strip().isdigit() and int(value.strip()) >= 1:
        return int(value.strip())
    return None


def add_money(errors, data, field, *, required, label):
    if field not in data or data.get(field) is None or data.get(field) == '':
        if required:
            errors.setdefault(field, [f'{label} is required.'])
        return None
    value = data.get(field)
    if _is_bool(value) or isinstance(value, str) and value.strip() == '':
        errors.setdefault(field, [f'{label} must be a number greater than or equal to 0.'])
        return None
    try:
        number = Decimal(str(value))
    except Exception:
        errors.setdefault(field, [f'{label} must be a number greater than or equal to 0.'])
        return None
    if number < 0 or number >= Decimal('10000000000'):
        errors.setdefault(field, [f'{label} must be a number greater than or equal to 0.'])
        return None
    return number.quantize(Decimal('0.01'))


def add_stock(errors, data):
    if 'stock' not in data or data.get('stock') is None or data.get('stock') == '':
        return None
    value = data.get('stock')
    parsed = _parse_non_negative_int(value)
    if parsed is None:
        errors.setdefault('stock', ['Stock must be an integer greater than or equal to 0.'])
        return None
    return parsed


def _parse_non_negative_int(value):
    if _is_bool(value):
        return None
    if isinstance(value, int) and 0 <= value <= 2147483647:
        return value
    if isinstance(value, float) and value.is_integer() and 0 <= value <= 2147483647:
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if text.isdigit() and int(text) <= 2147483647:
            return int(text)
    return None


def add_tags(errors, data):
    if 'tags' not in data:
        return None
    value = data.get('tags')
    if not isinstance(value, list) or not 1 <= len(value) <= 20:
        errors.setdefault('tags', ['tags must be an array of tag ids.'])
        return None
    parsed = []
    for entry in value:
        number = _parse_positive_int(entry)
        if number is None:
            errors.setdefault('tags', ['tags must be an array of positive integers.'])
            return None
        parsed.append(number)
    return list(dict.fromkeys(parsed))


def add_order_items(errors, data):
    if 'items' not in data or is_blank(data.get('items')):
        errors.setdefault('items', ['Items is required.'])
        return None
    items = data.get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        errors.setdefault('items', ['Items must be a non-empty array.'])
        return None
    cleaned = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors.setdefault('items', [f'items.{index} must be an object.'])
            return None
        product_id = _parse_positive_int(item.get('product_id'))
        if product_id is None:
            errors.setdefault('items', [f'items.{index}.product_id must be a positive integer.'])
            return None
        quantity = _parse_positive_int(item.get('quantity'))
        if quantity is None:
            errors.setdefault('items', [f'items.{index}.quantity must be an integer greater than or equal to 1.'])
            return None
        cleaned.append({'product_id': product_id, 'quantity': quantity})
    return cleaned


def add_status(errors, data):
    if 'status' not in data or is_blank(data.get('status')):
        errors.setdefault('status', ['Status is required.'])
        return None
    value = data.get('status')
    if not isinstance(value, str):
        errors.setdefault('status', ['Status must be a string.'])
        return None
    if value not in ORDER_STATUSES:
        errors.setdefault('status', [f"Status must be one of: {', '.join(ORDER_STATUSES)}."])
        return None
    return value


def optional_positive_query(errors, params, field):
    if field not in params or params.get(field) in (None, ''):
        return None
    parsed = _parse_positive_int(params.get(field))
    if parsed is None:
        errors.setdefault(field, [f'{field} must be a positive integer.'])
        return None
    return parsed


def optional_money_query(errors, params, field):
    if field not in params or params.get(field) in (None, ''):
        return None
    value = params.get(field)
    try:
        number = Decimal(str(value))
    except Exception:
        errors.setdefault(field, [f'{field} must be a number greater than or equal to 0.'])
        return None
    if number < 0:
        errors.setdefault(field, [f'{field} must be a number greater than or equal to 0.'])
        return None
    return number
