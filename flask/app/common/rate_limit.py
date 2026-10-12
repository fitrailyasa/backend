"""In-memory rate limiters.

Three limiters live here:

* ``rate_limited`` - the original per-endpoint, per-IP decorator on the auth routes.
* ``enforce_global_rate_limit`` - 300 requests / 60s per IP on every route except
  ``/health`` and the API index page.
* ``enforce_login_rate_limit`` - sliding-window failed-login counters keyed on the
  normalized email and on the client IP.

Counters are per process: they reset when the process restarts and are not shared
between workers. Swap the stores for Redis before running multiple instances.
"""

import math
import time
from functools import wraps

from flask import current_app, request

from app.common.responses import fail

_BUCKETS = {}  # (endpoint, ip) -> fixed window for the auth route decorator
_GLOBAL = {}  # ip -> fixed window for the global request limiter
_LOGIN_FAILURES = {}  # normalized email -> failure timestamps (ms), sliding window
_LOGIN_IP_FAILURES = {}  # client ip -> failure timestamps (ms), sliding window

# Full-store pruning kicks in once a store grows past this many keys so expired
# entries can never make the dictionaries grow without bound.
_MAX_STORE_KEYS = 1000

# Paths excluded from the global limiter (route-index page included per spec).
_GLOBAL_EXEMPT_PATHS = frozenset({"/health", "/api/v1", "/"})

LOGIN_LOCK_MESSAGE = "Too many failed login attempts. Please try again later."


def clear_rate_limits():
    """Reset the route and global limiter stores (test hook)."""
    _BUCKETS.clear()
    _GLOBAL.clear()


def clear_login_rate_limits():
    """Reset the failed-login counters (test hook, wired into ``tests/conftest.py``)."""
    _LOGIN_FAILURES.clear()
    _LOGIN_IP_FAILURES.clear()


def normalize_email(email):
    """Trim + lowercase so ``Admin@X.com`` cannot bypass the per-email limit."""
    return str(email or "").strip().lower()


def client_ip():
    """Client IP for limiting.

    ``TRUST_PROXY`` wraps the app in ``ProxyFix``, which is the only place
    ``X-Forwarded-For`` is ever honoured; otherwise this is the socket address.
    """
    return request.remote_addr or "unknown"


def _live(stamps, window_ms, now):
    return [stamp for stamp in stamps if stamp + window_ms > now]


def _prune_store(store, window_ms, now):
    for key in list(store.keys()):
        live = _live(store[key], window_ms, now)
        if live:
            store[key] = live
        else:
            store.pop(key, None)


def _apply_headers(response, headers):
    for key, value in headers.items():
        response.headers[key] = value
    return response


def rate_limited(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        limit = int(current_app.config["AUTH_RATE_LIMIT_MAX"])
        window_ms = int(current_app.config["AUTH_RATE_LIMIT_WINDOW_MS"])
        if limit <= 0:
            return fn(*args, **kwargs)

        now = time.time() * 1000
        key = (request.endpoint or fn.__name__, client_ip())
        entry = _BUCKETS.get(key)
        if entry is None or entry["reset_at"] <= now:
            entry = {"count": 1, "reset_at": now + window_ms}
            _BUCKETS[key] = entry
        else:
            entry["count"] += 1

        remaining = max(0, limit - entry["count"])
        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(int(entry["reset_at"] // 1000)),
        }
        if entry["count"] > limit:
            retry_after = max(1, int((entry["reset_at"] - now + 999) // 1000))
            headers["Retry-After"] = str(retry_after)
            response = fail("Too many requests, please try again later", 429)
            return _apply_headers(response, headers)

        response = fn(*args, **kwargs)
        return _apply_headers(response, headers)

    return wrapper


def enforce_global_rate_limit():
    """``before_request`` hook: 300 requests / 60s per IP, ``/health`` excluded.

    Returns ``None`` to continue or a 429 envelope when the IP is over the limit.
    Disabled automatically in the test environment (``RATE_LIMIT_ENABLED = False``
    in ``TestingConfig`` and whenever the env flag says ``test``).
    """
    if not current_app.config.get("RATE_LIMIT_ENABLED", True):
        return None
    if (request.path.rstrip("/") or "/") in _GLOBAL_EXEMPT_PATHS:
        return None

    limit = int(current_app.config["RATE_LIMIT_MAX"])
    window_ms = int(current_app.config["RATE_LIMIT_WINDOW_MS"])
    if limit <= 0:
        return None

    now = time.time() * 1000
    ip = client_ip()
    entry = _GLOBAL.get(ip)
    if entry is None or entry["reset_at"] <= now:
        if len(_GLOBAL) > _MAX_STORE_KEYS:
            _prune_store(_GLOBAL, window_ms, now)
        entry = {"count": 1, "reset_at": now + window_ms}
        _GLOBAL[ip] = entry
    else:
        entry["count"] += 1

    if entry["count"] > limit:
        retry_after = max(1, int((entry["reset_at"] - now + 999) // 1000))
        response = fail("Too many requests, please try again later", 429)
        response.headers["Retry-After"] = str(retry_after)
        return response
    return None


def enforce_login_rate_limit(email):
    """Return a 429 envelope when the email or IP counter is exhausted, else ``None``.

    Called before the password hash is touched: a locked account must not spend
    time verifying credentials. ``Retry-After`` is seconds until the oldest
    failure in the triggering window expires (always >= 1).
    """
    now = time.time() * 1000
    checks = (
        (_LOGIN_FAILURES, normalize_email(email), "LOGIN_RATE_LIMIT_MAX", "LOGIN_RATE_LIMIT_WINDOW_MS"),
        (_LOGIN_IP_FAILURES, client_ip(), "LOGIN_IP_RATE_LIMIT_MAX", "LOGIN_IP_RATE_LIMIT_WINDOW_MS"),
    )
    retry_after = 0
    for store, key, max_name, window_name in checks:
        limit = int(current_app.config[max_name])
        window_ms = int(current_app.config[window_name])
        if limit <= 0:
            continue
        stamps = _live(store.get(key, ()), window_ms, now)
        if stamps:
            store[key] = stamps
        else:
            store.pop(key, None)
        if len(stamps) >= limit:
            oldest = min(stamps)
            retry_after = max(retry_after, int(math.ceil((oldest + window_ms - now) / 1000)))

    if retry_after <= 0:
        return None

    response = fail(LOGIN_LOCK_MESSAGE, 429)
    response.headers["Retry-After"] = str(max(1, retry_after))
    return response


def record_login_failure(email):
    """Count one failed credential check for the email and the client IP."""
    now = time.time() * 1000
    _record_failure(
        _LOGIN_FAILURES,
        normalize_email(email),
        int(current_app.config["LOGIN_RATE_LIMIT_WINDOW_MS"]),
        now,
    )
    _record_failure(
        _LOGIN_IP_FAILURES,
        client_ip(),
        int(current_app.config["LOGIN_IP_RATE_LIMIT_WINDOW_MS"]),
        now,
    )


def reset_login_rate_limit(email):
    """A successful login clears that email's counter."""
    _LOGIN_FAILURES.pop(normalize_email(email), None)


def _record_failure(store, key, window_ms, now):
    stamps = _live(store.get(key, ()), window_ms, now)
    stamps.append(now)
    store[key] = stamps
    if len(store) > _MAX_STORE_KEYS:
        _prune_store(store, window_ms, now)
