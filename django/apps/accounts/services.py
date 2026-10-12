from django.contrib.auth.hashers import check_password, make_password

from apps.accounts.models import User
from apps.accounts.serializers import serialize_user
from apps.accounts.tokens import issue_token_pair

from apps.core.exceptions import ApiError
from apps.core.listing import apply_search, apply_sort, paginate, parse_list_query, raise_if_errors
from apps.core.ratelimit import enforce_login_rate_limit, record_login_failure, reset_login_rate_limit
from apps.core.validate import (
    add_email,
    add_password,
    add_role,
    add_string,
    is_blank,
    require_dict,
)

USER_SORTABLE = ['id', 'name', 'email', 'role', 'created_at', 'updated_at']

INVALID_CREDENTIALS_MESSAGE = 'These credentials do not match our records'

_DUMMY_HASH = None


def _email_taken(email, exclude_id=None):
    queryset = User.objects.filter(email=email)
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    if queryset.exists():
        raise ApiError.unprocessable('Validation failed', {'email': ['The email has already been taken.']})


def _get_user(pk):
    user = User.objects.filter(pk=pk).first()
    if user is None:
        raise ApiError.not_found('User not found')
    return user


def auth_payload(user):
    return {'user': serialize_user(user), **issue_token_pair(user)}


def validate_register(data):
    data = require_dict(data)
    errors = {}
    name = add_string(errors, data, 'name', label='Name', min_len=2, max_len=100, required=True)
    email = add_email(errors, data, required=True)
    password = add_password(errors, data, required=True, confirm=True)
    raise_if_errors(errors)
    return {'name': name, 'email': email, 'password': password}


def register(data):
    cleaned = validate_register(data)
    _email_taken(cleaned['email'])
    user = User(name=cleaned['name'], email=cleaned['email'], role='user', password=cleaned['password'])
    user.save()
    return auth_payload(user)


def validate_login(data):
    data = require_dict(data)
    errors = {}
    email = add_email(errors, data, required=True)
    if 'password' not in data or is_blank(data.get('password')):
        errors.setdefault('password', ['Password is required.'])
        password = None
    elif not isinstance(data.get('password'), str):
        errors.setdefault('password', ['Password must be a string.'])
        password = None
    else:
        password = data.get('password')
    raise_if_errors(errors)
    return email, password


def _dummy_hash():
    """Fixed hash for timing-safe compares when the email does not exist."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = make_password('timing-equalization-placeholder')
    return _DUMMY_HASH


def login(data, ip='unknown'):
    email, password = validate_login(data)
    enforce_login_rate_limit(email, ip)
    user = User.objects.filter(email=email).first()
    if user is None:
        check_password(password, _dummy_hash())
        record_login_failure(email, ip)
        raise ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE)
    if not user.check_password(password):
        record_login_failure(email, ip)
        raise ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE)
    reset_login_rate_limit(email)
    return auth_payload(user)


def list_users(params):
    errors = {}
    query = parse_list_query(params, USER_SORTABLE, errors=errors)
    raise_if_errors(errors)
    queryset = apply_search(User.objects.all(), query.search, ['name', 'email'])
    role = params.get('role')
    if role not in (None, ''):
        queryset = queryset.filter(role=role)
    queryset = apply_sort(queryset, query)
    rows, meta = paginate(queryset, query)
    return [serialize_user(row) for row in rows], meta


def get_user(pk):
    return serialize_user(_get_user(pk))


def _validate_user_write(data, partial):
    data = require_dict(data)
    errors = {}
    cleaned = {}
    name = add_string(errors, data, 'name', label='Name', min_len=2, max_len=100, required=not partial)
    if name is not None:
        cleaned['name'] = name
    email = add_email(errors, data, required=not partial)
    if email is not None:
        cleaned['email'] = email
    password = add_password(errors, data, required=not partial, confirm=False)
    if password is not None:
        cleaned['password'] = password
    role = add_role(errors, data)
    if role is not None:
        cleaned['role'] = role
    raise_if_errors(errors)
    return cleaned


def create_user(data):
    cleaned = _validate_user_write(data, partial=False)
    _email_taken(cleaned['email'])
    user = User(
        name=cleaned['name'],
        email=cleaned['email'],
        password=cleaned['password'],
        role=cleaned.get('role') or 'user',
    )
    user.save()
    return serialize_user(user)


def update_user(pk, data, partial):
    user = _get_user(pk)
    cleaned = _validate_user_write(data, partial=partial)
    if 'email' in cleaned:
        _email_taken(cleaned['email'], exclude_id=user.id)
        user.email = cleaned['email']
    if not partial:
        user.name = cleaned['name']
        user.password = cleaned['password']
        user.role = cleaned.get('role') or 'user'
    else:
        if 'name' in cleaned:
            user.name = cleaned['name']
        if 'password' in cleaned:
            user.password = cleaned['password']
        if 'role' in cleaned:
            user.role = cleaned['role']
    user.save()
    return serialize_user(user)


def validate_profile(data):
    data = require_dict(data)
    errors = {}
    if 'role' in data:
        errors['role'] = ['You cannot change your own role.']
    cleaned = {}
    name = add_string(errors, data, 'name', label='Name', min_len=2, max_len=100, required=False)
    if name is not None:
        cleaned['name'] = name
    email = add_email(errors, data, required=False)
    if email is not None:
        cleaned['email'] = email
    password = add_password(errors, data, required=False, confirm=False)
    if password is not None:
        cleaned['password'] = password
    if 'password_confirmation' in data and not is_blank(data.get('password_confirmation')):
        if 'password' not in data or is_blank(data.get('password')):
            errors['password_confirmation'] = ['Password is required when password_confirmation is provided.']
        elif data.get('password_confirmation') != data.get('password'):
            errors['password_confirmation'] = ['password_confirmation must match password.']
    raise_if_errors(errors)
    return cleaned


def update_profile(user_id, data):
    user = _get_user(user_id)
    cleaned = validate_profile(data)
    if 'email' in cleaned:
        _email_taken(cleaned['email'], exclude_id=user.id)
        user.email = cleaned['email']
    if 'name' in cleaned:
        user.name = cleaned['name']
    if 'password' in cleaned:
        user.password = cleaned['password']
    user.save()
    return serialize_user(user)


def delete_user(pk):
    user = _get_user(pk)
    user.delete()
