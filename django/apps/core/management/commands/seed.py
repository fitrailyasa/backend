from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductTag, Tag
from apps.comments.models import Comment
from apps.core.slugify import slugify
from apps.orders.models import Order, OrderItem
from apps.orders.services import create_order

ADMIN = {'name': 'Site Administrator', 'email': 'admin@example.com', 'password': 'password', 'role': 'admin'}

USERS = [
    {'name': 'User', 'email': 'user@example.com', 'password': 'password', 'role': 'user'},
    {'name': 'User 2', 'email': 'user2@example.com', 'password': 'password', 'role': 'user'},
    {'name': 'User 3', 'email': 'user3@example.com', 'password': 'password', 'role': 'user'},
    {'name': 'User 4', 'email': 'user4@example.com', 'password': 'password', 'role': 'user'},
    {'name': 'User 5', 'email': 'user5@example.com', 'password': 'password', 'role': 'user'},
]

CATEGORIES = [
    {'name': 'Electronics', 'description': 'Phones, laptops, audio and every day gadgets.'},
    {'name': 'Books', 'description': 'Fiction, non fiction and academic books.'},
    {'name': 'Home & Living', 'description': 'Kitchenware, decoration and furniture.'},
]

TAGS = ['Featured', 'New Arrival', 'Best Seller', 'Discount', 'Premium', 'Eco Friendly']

PRODUCTS = [
    {'category': 'Electronics', 'name': 'Smartphone X Pro', 'price': 8990000, 'stock': 40, 'description': '6.7 inch AMOLED display with a triple camera.'},
    {'category': 'Electronics', 'name': 'Wireless Earbuds Z', 'price': 749000, 'stock': 120, 'description': 'Active noise cancelling earbuds with 30 hours of playback.'},
    {'category': 'Electronics', 'name': 'Ultra Slim Laptop 14', 'price': 15999000, 'stock': 25, 'description': '14 inch ultrabook with 16GB RAM and 512GB SSD.'},
    {'category': 'Electronics', 'name': 'Smart Watch S2', 'price': 1299000, 'stock': 80, 'description': 'GPS tracking, heart rate and sleep monitoring.'},
    {'category': 'Electronics', 'name': 'Mechanical Keyboard K1', 'price': 899000, 'stock': 60, 'description': 'Hot swappable switches with a aluminium frame.'},
    {'category': 'Books', 'name': 'The Pragmatic Programmer', 'price': 289000, 'stock': 200, 'description': 'A classic guide to software craftsmanship.'},
    {'category': 'Books', 'name': 'Clean Architecture', 'price': 315000, 'stock': 150, 'description': 'A craftsman guide to software structure and design.'},
    {'category': 'Books', 'name': 'Daring Greatly', 'price': 199000, 'stock': 180, 'description': 'How to build a remarkable life at work.'},
    {'category': 'Home & Living', 'name': 'Cast Iron Skillet 26cm', 'price': 349000, 'stock': 90, 'description': 'Pre seasoned skillet, oven safe up to 260C.'},
    {'category': 'Home & Living', 'name': 'Linen Table Runner', 'price': 129000, 'stock': 140, 'description': 'Hand washed linen runner for a 180cm table.'},
]

ORDERS = [
    {'user': 0, 'status': 'completed', 'items': [{'product': 0, 'quantity': 1}, {'product': 4, 'quantity': 2}]},
    {'user': 1, 'status': 'shipped', 'items': [{'product': 2, 'quantity': 1}]},
    {'user': 2, 'status': 'paid', 'items': [{'product': 1, 'quantity': 3}]},
    {'user': 3, 'status': 'pending', 'items': [{'product': 5, 'quantity': 2}, {'product': 7, 'quantity': 1}]},
    {'user': 4, 'status': 'completed', 'items': [{'product': 8, 'quantity': 1}]},
    {'user': 0, 'status': 'cancelled', 'items': [{'product': 3, 'quantity': 1}]},
    {'user': 1, 'status': 'paid', 'items': [{'product': 6, 'quantity': 4}]},
    {'user': 2, 'status': 'pending', 'items': [{'product': 9, 'quantity': 2}]},
    {'user': 3, 'status': 'shipped', 'items': [{'product': 0, 'quantity': 2}, {'product': 1, 'quantity': 1}]},
    {'user': 4, 'status': 'completed', 'items': [{'product': 5, 'quantity': 1}, {'product': 8, 'quantity': 2}]},
]

COMMENTS = [
    {'product': 0, 'user': 1, 'body': 'Battery life is honestly better than advertised.'},
    {'product': 0, 'user': 2, 'body': 'Great phone, only wish the charger was included.'},
    {'product': 0, 'user': 3, 'body': 'Camera performs well even at night.'},
    {'product': 1, 'user': 0, 'body': 'Comfortable for long listening sessions.'},
    {'product': 1, 'user': 4, 'body': 'The case is a little bulky but the sound is excellent.'},
    {'product': 2, 'user': 2, 'body': 'Replaced my old laptop and the difference is night and day.'},
    {'product': 2, 'user': 3, 'body': 'Keyboard travel is comfortable for long coding sessions.'},
    {'product': 3, 'user': 1, 'body': 'Battery lasts about three days with notifications on.'},
    {'product': 4, 'user': 0, 'body': 'The tactile feel of these switches is superb.'},
    {'product': 4, 'user': 2, 'body': 'Loud enough for an office, not for late night work.'},
    {'product': 5, 'user': 3, 'body': 'Still relevant in 2026, highly recommended.'},
    {'product': 6, 'user': 4, 'body': 'Changed how I structure my projects.'},
    {'product': 7, 'user': 1, 'body': 'A gentle book that rewards a slow reader.'},
    {'product': 8, 'user': 2, 'body': 'Pre seasoning works perfectly out of the box.'},
    {'product': 9, 'user': 0, 'body': 'Colour matches the photos and it washes well.'},
]


def _create_user(payload):
    user = User(name=payload['name'], email=payload['email'], role=payload['role'], password=payload['password'])
    user.save()
    return user


def _reset_sequences():
    tables = [
        'comments',
        'order_items',
        'orders',
        'product_tag',
        'products',
        'tags',
        'categories',
        'users',
    ]
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute('DELETE FROM sqlite_sequence')
        elif connection.vendor == 'mysql':
            for table in tables:
                cursor.execute(f'ALTER TABLE {table} AUTO_INCREMENT = 1')


def _wipe():
    Comment.objects.all().delete()
    OrderItem.objects.all().delete()
    Order.objects.all().delete()
    ProductTag.objects.all().delete()
    Product.objects.all().delete()
    Tag.objects.all().delete()
    Category.objects.all().delete()
    User.objects.all().delete()
    _reset_sequences()


def seed_demo_data(*, reset=True):
    if reset:
        _wipe()
    elif User.objects.filter(email=ADMIN['email']).exists():
        return None

    users = [_create_user(ADMIN)]
    for payload in USERS:
        users.append(_create_user(payload))

    categories = [
        Category.objects.create(name=item['name'], slug=slugify(item['name']), description=item['description'])
        for item in CATEGORIES
    ]
    category_by_name = {category.name: category for category in categories}

    tags = [Tag.objects.create(name=name, slug=slugify(name)) for name in TAGS]

    products = []
    for index, payload in enumerate(PRODUCTS):
        product = Product.objects.create(
            category=category_by_name[payload['category']],
            name=payload['name'],
            slug=slugify(payload['name']),
            description=payload['description'],
            price=payload['price'],
            stock=payload['stock'],
        )
        assigned = [tag for tag_index, tag in enumerate(tags) if (tag_index + index) % 3 == 0]
        if assigned:
            product.tags.set(assigned)
        products.append(product)

    for payload in ORDERS:
        created = create_order(
            users[payload['user']],
            {
                'items': [
                    {'product_id': products[item['product']].id, 'quantity': item['quantity']}
                    for item in payload['items']
                ]
            },
        )
        if payload['status'] != 'pending':
            Order.objects.filter(pk=created['id']).update(status=payload['status'])

    for payload in COMMENTS:
        Comment.objects.create(
            product=products[payload['product']],
            user=users[payload['user']],
            body=payload['body'],
        )

    return {
        'users': len(users),
        'categories': len(categories),
        'products': len(products),
        'tags': len(tags),
        'orders': len(ORDERS),
        'comments': len(COMMENTS),
    }


class Command(BaseCommand):
    help = 'Load demo data. Resets existing rows by default so the command is safe to re-run.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-reset',
            action='store_true',
            help='Skip seeding when admin@example.com already exists.',
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            summary = seed_demo_data(reset=not options['no_reset'])
        if summary is None:
            self.stdout.write(self.style.WARNING('[seed] demo data already present, skipped'))
            return
        self.stdout.write(self.style.SUCCESS(f'[seed] demo data created: {summary}'))
        self.stdout.write('[seed] admin login -> admin@example.com / password')
