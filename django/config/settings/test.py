from .base import *  # noqa: F403

DEBUG = False
BCRYPT_ROUNDS = 4
RATE_LIMIT_MAX = 1000

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'TEST': {
            'NAME': ':memory:',
        },
    }
}
