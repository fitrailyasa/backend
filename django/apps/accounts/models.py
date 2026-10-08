from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.hashers import make_password
from django.db import models

from apps.core.fields import DateTimeNoFractionField, MysqlEnumField, RemovedField

ROLES = ('user', 'admin')


def _looks_hashed(value):
    return (
        isinstance(value, str)
        and (
            value.startswith('bcrypt$')
            or value.startswith('$2a$')
            or value.startswith('$2b$')
            or value.startswith('$2y$')
        )
    )


class User(AbstractBaseUser):
    """Custom user. The hash lives in a column literally named password."""

    last_login = RemovedField()
    password = models.CharField(max_length=255)
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=150, unique=True)
    role = MysqlEnumField(
        max_length=20,
        enum_values=list(ROLES),
        choices=[(role, role) for role in ROLES],
        default='user',
    )
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'

    def check_password(self, raw_password):
        stored = self.password or ''
        if stored.startswith('bcrypt$'):
            stored = stored[len('bcrypt$'):]
        if stored.startswith(('$2a$', '$2b$', '$2y$')):
            import bcrypt

            try:
                return bcrypt.checkpw(str(raw_password).encode(), stored.encode())
            except ValueError:
                return False
        return super().check_password(raw_password)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if self.password and not _looks_hashed(self.password):
            self.password = make_password(self.password)
            if update_fields is not None:
                kwargs['update_fields'] = set(update_fields) | {'password'}
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return True

    def __str__(self):
        return self.email
