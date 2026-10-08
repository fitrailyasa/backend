from django.conf import settings
from django.contrib.auth.hashers import BCryptPasswordHasher as DjangoBCryptPasswordHasher


class BCryptPasswordHasher(DjangoBCryptPasswordHasher):
    """bcrypt hasher. Cost comes from settings.BCRYPT_ROUNDS (default 10)."""

    def salt(self):
        bcrypt = self._load_library()
        rounds = int(getattr(settings, 'BCRYPT_ROUNDS', 10))
        return bcrypt.gensalt(rounds)
