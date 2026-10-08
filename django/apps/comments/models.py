from django.db import models

from apps.core.fields import DateTimeNoFractionField


class Comment(models.Model):
    id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(
        'catalog.Product',
        on_delete=models.CASCADE,
        db_column='product_id',
        related_name='comments',
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='comments',
    )
    body = models.TextField()
    created_at = DateTimeNoFractionField(auto_now_add=True)
    updated_at = DateTimeNoFractionField(auto_now=True)

    class Meta:
        db_table = 'comments'
