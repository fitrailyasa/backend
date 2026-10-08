import time

from django.conf import settings

_SET = {}


def blacklist_token(payload):
    if not payload or not payload.get('jti'):
        return
    exp = payload.get('exp')
    now = int(time.time())
    ttl = max(0, int(exp) - now) if exp else int(settings.JWT_EXPIRES_IN)
    _SET[payload['jti']] = time.time() + max(1, ttl)
    _prune()


def is_blacklisted(payload):
    if not payload or not payload.get('jti'):
        return False
    expires_at = _SET.get(payload['jti'])
    if expires_at is None:
        return False
    if expires_at <= time.time():
        _SET.pop(payload['jti'], None)
        return False
    return True


def clear_blacklist():
    _SET.clear()


def _prune():
    if len(_SET) < 1000:
        return
    now = time.time()
    for jti, expires_at in list(_SET.items()):
        if expires_at <= now:
            _SET.pop(jti, None)
