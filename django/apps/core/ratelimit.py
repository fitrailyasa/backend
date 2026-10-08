import time

from django.conf import settings

from apps.core.exceptions import ApiError

_HITS = {}


def clear_rate_limits():
    _HITS.clear()


def enforce_rate_limit(request):
    maximum = settings.RATE_LIMIT_MAX
    if maximum <= 0:
        return

    window_ms = settings.RATE_LIMIT_WINDOW_MS
    identity = request.META.get('REMOTE_ADDR') or 'unknown'
    now = time.time() * 1000
    entry = _HITS.get(identity)
    if entry is None or entry['reset_at'] <= now:
        entry = {'count': 1, 'reset_at': now + window_ms}
        _HITS[identity] = entry
    else:
        entry['count'] += 1

    if len(_HITS) > 5000:
        for key, value in list(_HITS.items()):
            if value['reset_at'] <= now:
                _HITS.pop(key, None)

    if entry['count'] > maximum:
        raise ApiError.too_many('Too many requests, please try again later')
