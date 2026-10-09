from django.db import models

from apps.core.fields import DateTimeNoFractionField


class Category(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=120, unique=True)
    description = models.TextField(null=True, blank=True)
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'categories'

    def __str__(self):
        return self.name
