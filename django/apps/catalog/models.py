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
