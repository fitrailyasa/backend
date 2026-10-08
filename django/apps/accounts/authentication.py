from rest_framework.authentication import BaseAuthentication

from apps.accounts.blacklist import is_blacklisted
from apps.accounts.models import User
from apps.accounts.tokens import verify_access_token
from apps.core.exceptions import ApiError


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = extract_bearer(request)
        if token is None:
            header = request.META.get('HTTP_AUTHORIZATION', '')
            if not header:
                return None
            raise ApiError.unauthorized('Token is invalid')

        payload = verify_access_token(token)
        if is_blacklisted(payload):
            raise ApiError.unauthorized('Token has been revoked')

        user = User.objects.filter(pk=payload.get('sub')).first()
        if user is None:
            raise ApiError.unauthorized('Token is invalid')
        return (user, payload)

    def authenticate_header(self, request):
        return 'Bearer'


def extract_bearer(request):
    header = request.META.get('HTTP_AUTHORIZATION') or ''
    if not isinstance(header, str) or not header.strip():
        return None
    parts = header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer' or not parts[1].strip():
        return None
    return parts[1].strip()
