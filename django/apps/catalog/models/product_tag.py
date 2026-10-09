from django.db import models

from apps.catalog.models.product import Product
from apps.catalog.models.tag import Tag


class ProductTag(models.Model):
    id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        db_column='product_id',
        related_name='product_tags',
    )
    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        db_column='tag_id',
        related_name='product_tags',
    )

    class Meta:
        db_table = 'product_tag'
        constraints = [
            models.UniqueConstraint(fields=['product', 'tag'], name='product_tag_product_id_tag_id_unique'),
        ]
