from django.db import models

from apps.core.fields import DateTimeNoFractionField
from apps.orders.models.order import Order


class OrderItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        db_column='order_id',
        related_name='items',
    )
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.RESTRICT,
        db_column='product_id',
        related_name='order_items',
    )
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'order_items'
