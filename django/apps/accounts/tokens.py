import time
import uuid

import jwt
from django.conf import settings
from jwt import ExpiredSignatureError, InvalidTokenError

from apps.core.exceptions import ApiError


def _encode(user, typ, secret, ttl):
    now = int(time.time())
    payload = {
        'sub': str(user.id),
        'role': user.role,
        'typ': typ,
        'iat': now,
        'exp': now + int(ttl),
        'jti': str(uuid.uuid4()),
        'iss': settings.JWT_ISSUER,
        'aud': settings.JWT_AUDIENCE,
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def issue_token_pair(user):
    return {
        'token': _encode(user, 'access', settings.JWT_ACCESS_SECRET, settings.JWT_EXPIRES_IN),
        'refresh_token': _encode(user, 'refresh', settings.JWT_REFRESH_SECRET, settings.JWT_REFRESH_EXPIRES_IN),
        'token_type': 'Bearer',
        'expires_in': int(settings.JWT_EXPIRES_IN),
    }


def _decode(token, secret):
    return jwt.decode(
        token,
        secret,
        algorithms=['HS256'],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={'require': ['exp', 'iat', 'sub']},
    )


def verify_access_token(token):
    try:
        payload = _decode(token, settings.JWT_ACCESS_SECRET)
    except ExpiredSignatureError as exc:
        raise ApiError.unauthorized('Token has expired') from exc
    except InvalidTokenError as exc:
        raise ApiError.unauthorized('Token is invalid') from exc
    if payload.get('typ') != 'access':
        raise ApiError.unauthorized('Token is invalid')
    return payload


def verify_refresh_token(token):
    try:
        payload = _decode(token, settings.JWT_REFRESH_SECRET)
    except ExpiredSignatureError as exc:
        raise ApiError.unauthorized('Token has expired') from exc
    except InvalidTokenError as exc:
        raise ApiError.unauthorized('Token is invalid') from exc
    if payload.get('typ') != 'refresh':
        raise ApiError.unauthorized('Token is invalid')
    return payload
