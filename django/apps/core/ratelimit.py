import time
from math import ceil

from django.conf import settings

from apps.core.exceptions import ApiError

_HITS = {}
_SLIDING = {}

_MAX_KEYS = 5000

LOGIN_LIMIT_MESSAGE = 'Too many failed login attempts. Please try again later.'
REQUEST_LIMIT_MESSAGE = 'Too many requests, please try again later'


def clear_rate_limits():
    _HITS.clear()
    _SLIDING.clear()


def clear_login_rate_limits():
    """Reset hook for the per-email login lockout counters."""
    for key in [key for key in _SLIDING if key.startswith('login:email:')]:
        _SLIDING.pop(key, None)


def client_ip(request):
    """Client IP. X-Forwarded-For is only trusted when TRUST_PROXY is enabled."""
    if getattr(settings, 'TRUST_PROXY', False):
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR') or ''
        for item in forwarded.split(','):
            item = item.strip()
            if item:
                return item
    return request.META.get('REMOTE_ADDR') or 'unknown'


def normalize_email(email):
    return (email or '').strip().lower()


def enforce_rate_limit(request):
    maximum = settings.RATE_LIMIT_MAX
    if maximum <= 0:
        return

    window_ms = settings.RATE_LIMIT_WINDOW_MS
    identity = client_ip(request)
    now = time.time() * 1000
    entry = _HITS.get(identity)
    if entry is None or entry['reset_at'] <= now:
        entry = {'count': 1, 'reset_at': now + window_ms}
        _HITS[identity] = entry
    else:
        entry['count'] += 1

    if len(_HITS) > _MAX_KEYS:
        for key, value in list(_HITS.items()):
            if value['reset_at'] <= now:
                _HITS.pop(key, None)

    if entry['count'] > maximum:
        retry_after = max(1, ceil((entry['reset_at'] - now) / 1000))
        raise ApiError.too_many(REQUEST_LIMIT_MESSAGE, headers={'Retry-After': str(retry_after)})


def enforce_global_rate_limit(identity):
    """Sliding-window limit for all routes: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS per IP."""
    maximum = settings.RATE_LIMIT_MAX
    if maximum <= 0:
        return

    window_ms = settings.RATE_LIMIT_WINDOW_MS
    now = time.time() * 1000
    hits = _SLIDING.setdefault('global:' + (identity or 'unknown'), [])
    _prune(hits, now, window_ms)
    _sweep(now)
    hits.append(now)

    if len(hits) > maximum:
        retry_after = max(1, ceil((hits[0] + window_ms - now) / 1000))
        raise ApiError.too_many(REQUEST_LIMIT_MESSAGE, headers={'Retry-After': str(retry_after)})


def enforce_login_rate_limit(email, ip):
    """Lock out before password verification when the email or IP failed too often."""
    now = time.time() * 1000
    checks = (
        ('login:email:' + normalize_email(email), settings.LOGIN_RATE_LIMIT_MAX, settings.LOGIN_RATE_LIMIT_WINDOW_MS),
        ('login:ip:' + (ip or 'unknown'), settings.LOGIN_IP_RATE_LIMIT_MAX, settings.LOGIN_IP_RATE_LIMIT_WINDOW_MS),
    )
    for key, maximum, window_ms in checks:
        if maximum <= 0:
            continue
        hits = _SLIDING.get(key)
        if hits is None:
            continue
        _prune(hits, now, window_ms)
        if len(hits) >= maximum:
            retry_after = max(1, ceil((hits[0] + window_ms - now) / 1000))
            raise ApiError.too_many(LOGIN_LIMIT_MESSAGE, headers={'Retry-After': str(retry_after)})


def record_login_failure(email, ip):
    """Record one failed credential check against the email and the client IP."""
    now = time.time() * 1000
    entries = (
        ('login:email:' + normalize_email(email), settings.LOGIN_RATE_LIMIT_WINDOW_MS),
        ('login:ip:' + (ip or 'unknown'), settings.LOGIN_IP_RATE_LIMIT_WINDOW_MS),
    )
    for key, window_ms in entries:
        hits = _SLIDING.setdefault(key, [])
        _prune(hits, now, window_ms)
        hits.append(now)
    _sweep(now)


def reset_login_rate_limit(email):
    """A successful login clears that email's failure counter."""
    _SLIDING.pop('login:email:' + normalize_email(email), None)


def _prune(hits, now, window_ms):
    cutoff = now - window_ms
    while hits and hits[0] <= cutoff:
        hits.pop(0)
    return hits


def _sweep(now):
    """Drop stale keys so the in-memory store cannot grow forever."""
    if len(_SLIDING) <= _MAX_KEYS:
        return
    horizon = max(
        settings.RATE_LIMIT_WINDOW_MS,
        settings.LOGIN_RATE_LIMIT_WINDOW_MS,
        settings.LOGIN_IP_RATE_LIMIT_WINDOW_MS,
    )
    cutoff = now - horizon
    for key, hits in list(_SLIDING.items()):
        _prune(hits, now, horizon)
        if not hits or hits[-1] <= cutoff:
            _SLIDING.pop(key, None)
