import pytest
from decimal import Decimal
from rest_framework.test import APIClient

from apps.accounts.blacklist import clear_blacklist
from apps.accounts.models import User
from apps.catalog.models import Category, Product
from apps.core.ratelimit import clear_rate_limits


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _reset_memory():
    clear_blacklist()
    clear_rate_limits()
    yield
    clear_blacklist()
    clear_rate_limits()


def test_health(api):
    response = api.get('/health')
    body = response.json()
    assert response.status_code == 200
    assert body['status'] == 'ok'
    assert isinstance(body['uptime'], (int, float))
    assert 'T' in body['timestamp']
    assert 'success' not in body


@pytest.mark.django_db
def test_register_login_and_me(api):
    registered = api.post(
        '/api/v1/auth/register',
        {
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'password',
            'password_confirmation': 'password',
        },
        format='json',
    )
    assert registered.status_code == 201
    payload = registered.json()
    assert payload['success'] is True
    assert payload['message'] == 'User registered successfully'
    assert payload['data']['token_type'] == 'Bearer'
    assert payload['data']['user']['role'] == 'user'
    assert payload['data']['user']['email'] == 'test@example.com'
    token = payload['data']['token']

    logged_in = api.post(
        '/api/v1/auth/login',
        {'email': 'test@example.com', 'password': 'password'},
        format='json',
    )
    assert logged_in.status_code == 200
    assert logged_in.json()['data']['user']['email'] == 'test@example.com'

    me = api.get('/api/v1/auth/me', HTTP_AUTHORIZATION=f'Bearer {token}')
    assert me.status_code == 200
    assert me.json()['data']['name'] == 'Test User'
    assert me.json()['success'] is True


@pytest.mark.django_db
def test_register_validation_returns_422(api):
    response = api.post(
        '/api/v1/auth/register',
        {
            'name': 'A',
            'email': 'not-an-email',
            'password': 'short',
            'password_confirmation': 'short',
        },
        format='json',
    )
    body = response.json()
    assert response.status_code == 422
    assert body['success'] is False
    assert body['message'] == 'Validation failed'
    assert isinstance(body['errors']['name'], list)
    assert isinstance(body['errors']['email'], list)
    assert isinstance(body['errors']['password'], list)


@pytest.mark.django_db
def test_password_is_never_returned(api):
    registered = api.post(
        '/api/v1/auth/register',
        {
            'name': 'Secret User',
            'email': 'secret@example.com',
            'password': 'password',
            'password_confirmation': 'password',
        },
        format='json',
    )
    user = registered.json()['data']['user']
    assert 'password' not in user

    logged_in = api.post(
        '/api/v1/auth/login',
        {'email': 'secret@example.com', 'password': 'password'},
        format='json',
    )
    assert 'password' not in logged_in.json()['data']['user']
    token = logged_in.json()['data']['token']
    me = api.get('/api/v1/users/me', HTTP_AUTHORIZATION=f'Bearer {token}')
    assert me.status_code == 200
    assert 'password' not in me.json()['data']


@pytest.mark.django_db
def test_missing_token_is_401(api):
    response = api.get('/api/v1/auth/me')
    body = response.json()
    assert response.status_code == 401
    assert body['success'] is False
    assert body['message'] == 'Authentication token is missing'
    assert 'errors' not in body


@pytest.mark.django_db
def test_non_admin_cannot_create_category(api):
    registered = api.post(
        '/api/v1/auth/register',
        {
            'name': 'User',
            'email': 'regular@example.com',
            'password': 'password',
            'password_confirmation': 'password',
        },
        format='json',
    )
    token = registered.json()['data']['token']
    response = api.post(
        '/api/v1/categories',
        {'name': 'Smuggled'},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    body = response.json()
    assert response.status_code == 403
    assert body['success'] is False
    assert 'errors' not in body


@pytest.mark.django_db
def test_product_list_pagination_meta(api):
    category = Category.objects.create(name='Electronics', slug='electronics')
    for index in range(11):
        Product.objects.create(
            category=category,
            name=f'Product {index}',
            slug=f'product-{index}',
            price=Decimal('10.00'),
            stock=5,
        )

    response = api.get('/api/v1/products?limit=10&page=1')
    body = response.json()
    assert response.status_code == 200
    assert body['success'] is True
    assert body['meta'] == {'page': 1, 'limit': 10, 'total': 11, 'total_pages': 2}
    assert len(body['data']) == 10


@pytest.mark.django_db
def test_order_create_snapshots_total_and_decrements_stock(api):
    user = User(name='Buyer', email='buyer@example.com', role='user', password='password')
    user.save()
    logged_in = api.post(
        '/api/v1/auth/login',
        {'email': 'buyer@example.com', 'password': 'password'},
        format='json',
    )
    token = logged_in.json()['data']['token']
    category = Category.objects.create(name='Books', slug='books')
    product = Product.objects.create(
        category=category,
        name='Clean Architecture',
        slug='clean-architecture',
        price=Decimal('15000.00'),
        stock=8,
    )

    response = api.post(
        '/api/v1/orders',
        {'items': [{'product_id': product.id, 'quantity': 2}]},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    body = response.json()
    assert response.status_code == 201
    assert body['data']['total'] == 30000
    assert isinstance(body['data']['total'], (int, float))
    product.refresh_from_db()
    assert product.stock == 6


@pytest.mark.django_db
def test_owner_cannot_set_order_to_paid(api):
    user = User(name='Buyer Two', email='buyer2@example.com', role='user', password='password')
    user.save()
    logged_in = api.post(
        '/api/v1/auth/login',
        {'email': 'buyer2@example.com', 'password': 'password'},
        format='json',
    )
    token = logged_in.json()['data']['token']
    category = Category.objects.create(name='Home', slug='home')
    product = Product.objects.create(
        category=category,
        name='Skillet',
        slug='skillet',
        price=Decimal('100.00'),
        stock=4,
    )
    created = api.post(
        '/api/v1/orders',
        {'items': [{'product_id': product.id, 'quantity': 1}]},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    order_id = created.json()['data']['id']
    response = api.patch(
        f'/api/v1/orders/{order_id}/status',
        {'status': 'paid'},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert response.status_code == 403
    assert response.json()['success'] is False
    assert 'errors' not in response.json()


@pytest.mark.django_db
def test_register_list_query_and_category_writes_are_validated(api):
    invalid = api.post(
        '/api/v1/auth/register',
        {
            'name': 'A',
            'email': 'bad',
            'password': 'short',
            'password_confirmation': 'nope',
        },
        format='json',
    )
    assert invalid.status_code == 422
    for field in ('name', 'email', 'password', 'password_confirmation'):
        assert isinstance(invalid.json()['errors'][field], list)

    listed = api.get('/api/v1/categories', {
        'page': '0',
        'limit': '0',
        'sort': 'nope',
        'order': 'sideways',
        'include': 'nope',
    })
    assert listed.status_code == 422
    for field in ('page', 'limit', 'sort', 'order', 'include'):
        assert isinstance(listed.json()['errors'][field], list)

    anonymous = api.post('/api/v1/categories', {'name': 'Valid Name'}, format='json')
    assert anonymous.status_code == 401

    admin = User(name='Query Admin', email='query-admin@example.com', role='admin', password='password')
    admin.save()
    logged_in = api.post(
        '/api/v1/auth/login',
        {'email': 'query-admin@example.com', 'password': 'password'},
        format='json',
    )
    token = logged_in.json()['data']['token']
    rejected = api.post(
        '/api/v1/categories',
        {'name': 'X', 'slug': 'Bad Slug'},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert rejected.status_code == 422
    assert isinstance(rejected.json()['errors']['name'], list)
    assert isinstance(rejected.json()['errors']['slug'], list)

    created = api.post(
        '/api/v1/categories',
        {'name': 'Valid Category Name'},
        format='json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert created.status_code == 201
    assert created.json()['data']['slug'] == 'valid-category-name'
