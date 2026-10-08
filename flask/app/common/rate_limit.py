"""In-memory rate limiter for auth routes. Counters are per endpoint and client IP."""

import time
from functools import wraps

from flask import current_app, request

from app.common.responses import fail

_BUCKETS = {}


def clear_rate_limits():
    _BUCKETS.clear()


def _apply_headers(response, headers):
    for key, value in headers.items():
        response.headers[key] = value
    return response


def rate_limited(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        limit = int(current_app.config["RATE_LIMIT_MAX"])
        window_ms = int(current_app.config["RATE_LIMIT_WINDOW_MS"])
        if limit <= 0:
            return fn(*args, **kwargs)

        now = time.time() * 1000
        key = (request.endpoint or fn.__name__, request.remote_addr or "unknown")
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
