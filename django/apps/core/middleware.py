from django.conf import settings
from django.http import JsonResponse

from apps.core.exceptions import ApiError
from apps.core.ratelimit import client_ip, enforce_global_rate_limit

RATE_LIMIT_EXEMPT = frozenset({'/health', '/api/v1'})

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

# The JSON API serves no assets; the Swagger UI (/api/v1/docs) is served from
# this same app and genuinely needs 'self' scripts/styles.
API_CSP = "default-src 'none'"
DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
)
DOCS_PATH = '/api/v1/docs'

HSTS_MAX_AGE = 'max-age=15552000'

FINGERPRINT_HEADERS = ('Server', 'X-Powered-By', 'X-AspNet-Version')


class SecurityHeadersMiddleware:
    """Security response headers + framework fingerprint removal."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        for name, value in SECURITY_HEADERS.items():
            response[name] = value
        response['Content-Security-Policy'] = DOCS_CSP if request.path == DOCS_PATH else API_CSP
        if getattr(settings, 'ENABLE_HSTS', False) and request.is_secure():
            response['Strict-Transport-Security'] = HSTS_MAX_AGE
        for name in FINGERPRINT_HEADERS:
            if response.has_header(name):
                del response[name]
        return response


class RateLimitMiddleware:
    """Global limit: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS per client IP."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'RATE_LIMIT_ENABLED', False) and request.path not in RATE_LIMIT_EXEMPT:
            try:
                enforce_global_rate_limit(client_ip(request))
            except ApiError as exc:
                return _error_response(exc)
        return self.get_response(request)


class BodyLimitMiddleware:
    """Cap request bodies at BODY_LIMIT bytes, answering with the standard envelope."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        limit = getattr(settings, 'BODY_LIMIT', 0)
        if limit > 0:
            try:
                length = int(request.META.get('CONTENT_LENGTH') or 0)
            except (TypeError, ValueError):
                length = 0
            if length > limit:
                return _error_response(ApiError.payload_too_large())
        return self.get_response(request)


def _error_response(exc):
    response = JsonResponse({'success': False, 'message': exc.message}, status=exc.status_code)
    for name, value in (getattr(exc, 'headers', None) or {}).items():
        response[name] = value
    return response
