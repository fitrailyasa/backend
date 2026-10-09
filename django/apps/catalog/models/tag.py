from django.db import models

from apps.core.fields import DateTimeNoFractionField


class Tag(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=60)
    slug = models.CharField(max_length=80, unique=True)
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'tags'

    def __str__(self):
        return self.name
