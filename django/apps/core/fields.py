from django.db import models


class RemovedField(models.Field):
    """Drop an inherited concrete field (AbstractBaseUser.last_login)."""

    def contribute_to_class(self, cls, name, private_only=False):
        # Mark the name as declared so ModelBase does not copy the parent column.
        setattr(cls, name, None)


class DateTimeNoFractionField(models.DateTimeField):
    """DATETIME without fractional seconds on MySQL. SQLite stays compatible."""

    def db_type(self, connection):
        if connection.vendor == 'mysql':
            return 'datetime'
        return super().db_type(connection)


class MysqlEnumField(models.CharField):
    """ENUM on MySQL. VARCHAR on SQLite so the test suite needs no MySQL server."""

    def __init__(self, *args, enum_values=None, **kwargs):
        self.enum_values = list(enum_values or [])
        if self.enum_values:
            kwargs.setdefault('max_length', max(len(value) for value in self.enum_values))
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        kwargs['enum_values'] = self.enum_values
        return name, path, args, kwargs

    def db_type(self, connection):
        if connection.vendor == 'mysql' and self.enum_values:
            quoted = ','.join("'" + value.replace("'", "''") + "'" for value in self.enum_values)
            return f'enum({quoted})'
        return super().db_type(connection)
