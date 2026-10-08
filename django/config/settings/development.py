from pathlib import Path

from .base import *  # noqa: F403
from .base import BASE_DIR, _bool, _raw

DB_DIALECT = str(_raw('DB_DIALECT', 'mysql')).lower()

if DB_DIALECT == 'sqlite':
    storage = _raw('DB_STORAGE', str(BASE_DIR / 'database' / 'dev.sqlite'))
    if storage != ':memory:':
        path = Path(storage)
        if not path.is_absolute():
            path = BASE_DIR / path
        path.parent.mkdir(parents=True, exist_ok=True)
        storage = path
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': storage,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': _raw('DB_NAME', 'backend_starter'),
            'USER': _raw('DB_USER', 'root'),
            'PASSWORD': _raw('DB_PASSWORD', ''),
            'HOST': _raw('DB_HOST', '127.0.0.1'),
            'PORT': _raw('DB_PORT', '3306'),
            'OPTIONS': {
                'charset': _raw('DB_CHARSET', 'utf8mb4'),
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }

DEBUG = _bool('DJANGO_DEBUG', True)
