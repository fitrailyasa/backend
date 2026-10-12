import os
import sys
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env_file = BASE_DIR / '.env'
if env_file.exists():
    env.read_env(env_file)


def _raw(key, default=None):
    value = os.environ.get(key)
    if value is None or str(value).strip() == '':
        return default
    return value


def _int(key, default):
    raw = _raw(key)
    if raw is None:
        return default
    return int(raw)


def _bool(key, default):
    raw = _raw(key)
    if raw is None:
        return default
    return str(raw).strip().lower() in {'1', 'true', 'yes', 'on'}


SECRET_KEY = _raw('DJANGO_SECRET_KEY', 'dev-only-secret-key-change-me-please-32chars')
DEBUG = _bool('DJANGO_DEBUG', True)
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'rest_framework',
    'drf_spectacular',
    'drf_spectacular_sidecar',
    'corsheaders',
    'apps.core.apps.CoreConfig',
    'apps.accounts.apps.AccountsConfig',
    'apps.catalog.apps.CatalogConfig',
    'apps.orders.apps.OrdersConfig',
    'apps.comments.apps.CommentsConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'apps.core.middleware.SecurityHeadersMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.core.middleware.RateLimitMiddleware',
    'apps.core.middleware.BodyLimitMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'database' / 'dev.sqlite',
    }
}

AUTH_USER_MODEL = 'accounts.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

APPEND_SLASH = False

PASSWORD_HASHERS = [
    'apps.accounts.hashers.BCryptPasswordHasher',
]
BCRYPT_ROUNDS = _int('BCRYPT_ROUNDS', 10)

JWT_SECRET = _raw('JWT_SECRET', 'insecure-development-secret-key-change')
JWT_ACCESS_SECRET = _raw('JWT_ACCESS_SECRET', JWT_SECRET)
JWT_REFRESH_SECRET = _raw('JWT_REFRESH_SECRET', JWT_SECRET)
JWT_EXPIRES_IN = _int('JWT_EXPIRES_IN', 3600)
JWT_REFRESH_EXPIRES_IN = _int('JWT_REFRESH_EXPIRES_IN', 604800)
JWT_ISSUER = _raw('JWT_ISSUER', 'backend-starter-django')
JWT_AUDIENCE = _raw('JWT_AUDIENCE', 'backend-starter-clients')

PAGINATION_LIMIT = _int('PAGINATION_LIMIT', 10)
PAGINATION_MAX_LIMIT = _int('PAGINATION_MAX_LIMIT', 100)

# Rate limiting must never flake the test suite.
_TEST_ENV = 'pytest' in sys.modules or 'test' in sys.argv

# Global limit for all routes (except /health and the route index), per client IP.
RATE_LIMIT_WINDOW_MS = _int('RATE_LIMIT_WINDOW_MS', 60000)
RATE_LIMIT_MAX = _int('RATE_LIMIT_MAX', 300)
RATE_LIMIT_ENABLED = _bool('RATE_LIMIT_ENABLED', True) and not _TEST_ENV

# Login lockout: failed credential checks per normalized email, then per client IP.
LOGIN_RATE_LIMIT_MAX = _int('LOGIN_RATE_LIMIT_MAX', 3)
LOGIN_RATE_LIMIT_WINDOW_MS = _int('LOGIN_RATE_LIMIT_WINDOW_MS', 900000)
LOGIN_IP_RATE_LIMIT_MAX = _int('LOGIN_IP_RATE_LIMIT_MAX', 10)
LOGIN_IP_RATE_LIMIT_WINDOW_MS = _int('LOGIN_IP_RATE_LIMIT_WINDOW_MS', 900000)

# Cap on JSON request bodies, in bytes (102400 = 100kb). 0 disables the cap.
BODY_LIMIT = _int('BODY_LIMIT', 102400)

# Only trust X-Forwarded-For / X-Forwarded-Proto when behind a reverse proxy.
TRUST_PROXY = _bool('TRUST_PROXY', False)
if TRUST_PROXY:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Strict-Transport-Security is sent only for HTTPS requests when enabled.
ENABLE_HSTS = _bool('ENABLE_HSTS', False)

# CORS: a concrete allowlist, never '*' together with credentials. An explicit
# '*' (or an empty value) falls back to the dev allowlist below.
_cors = _raw('CORS_ORIGINS') or _raw('CORS_ORIGIN') or ''
_cors_list = [item.strip() for item in _cors.split(',') if item.strip() and item.strip() != '*']
CORS_ALLOWED_ORIGINS = _cors_list or [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4200',
]
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_PREFLIGHT_MAX_AGE = 600

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.accounts.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': [
        'apps.core.renderers.ApiJSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'EXCEPTION_HANDLER': 'apps.core.exception_handler.api_exception_handler',
    'UNAUTHENTICATED_USER': None,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Backend Starter Kit API - Django',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_FAVICON_HREF': 'SIDECAR',
    'REDOC_DIST': 'SIDECAR',
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
        'docExpansion': 'list',
        'deepLinking': True,
    },
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'apps': {
            'handlers': ['console'],
            'level': 'ERROR',
        },
    },
}
