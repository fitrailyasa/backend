from django.db import models

from apps.core.fields import DateTimeNoFractionField, MysqlEnumField

ORDER_STATUSES = ('pending', 'paid', 'shipped', 'completed', 'cancelled')


class Order(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='orders',
    )
    status = MysqlEnumField(
        max_length=20,
        enum_values=list(ORDER_STATUSES),
        choices=[(status, status) for status in ORDER_STATUSES],
        default='pending',
    )
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'orders'

    def __str__(self):
        return f'Order {self.pk}'


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
