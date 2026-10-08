import os

_env = os.environ.get('DJANGO_ENV', 'development').strip().lower()

if _env == 'test':
    from .test import *  # noqa: F403
else:
    from .development import *  # noqa: F403
