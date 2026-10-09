from django.db import models

from apps.catalog.models.category import Category
from apps.catalog.models.tag import Tag
from apps.core.fields import DateTimeNoFractionField


class Product(models.Model):
    id = models.BigAutoField(primary_key=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.RESTRICT,
        db_column='category_id',
        related_name='products',
    )
    name = models.CharField(max_length=150)
    slug = models.CharField(max_length=180, unique=True)
    description = models.TextField(null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, through='ProductTag', related_name='products')
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name
