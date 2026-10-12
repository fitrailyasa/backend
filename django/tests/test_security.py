import json

import pytest
from django.http import JsonResponse
from django.test import RequestFactory
from django.conf import settings
from rest_framework.test import APIClient

from apps.core.middleware import RateLimitMiddleware
from apps.core.ratelimit import clear_rate_limits

LOGIN_URL = '/api/v1/auth/login'
REGISTER_URL = '/api/v1/auth/register'

LOCKOUT_MESSAGE = 'Too many failed login attempts. Please try again later.'


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _reset_memory():
    clear_rate_limits()
    yield
    clear_rate_limits()


def _register(api, email):
    response = api.post(
        REGISTER_URL,
        {
            'name': 'Lock Test',
            'email': email,
            'password': 'password',
            'password_confirmation': 'password',
        },
        format='json',
    )
    assert response.status_code == 201
    return response


def _login(api, email, password='password'):
    return api.post(LOGIN_URL, {'email': email, 'password': password}, format='json')


@pytest.mark.django_db
def test_three_failures_then_lockout_on_fourth_attempt(api):
    _register(api, 'lock@example.com')

    for _ in range(3):
        response = _login(api, 'lock@example.com', 'wrong-password')
        body = response.json()
        assert response.status_code == 401
        assert body['success'] is False
        assert 'errors' not in body

    locked = _login(api, 'lock@example.com', 'wrong-password')
    body = locked.json()
    assert locked.status_code == 429
    assert int(locked['Retry-After']) >= 1
    assert body == {'success': False, 'message': LOCKOUT_MESSAGE}
    assert 'errors' not in body


@pytest.mark.django_db
def test_correct_password_also_returns_429_while_locked(api):
    _register(api, 'locked-correct@example.com')

    for _ in range(3):
        assert _login(api, 'locked-correct@example.com', 'wrong-password').status_code == 401

    locked = _login(api, 'locked-correct@example.com', 'password')
    assert locked.status_code == 429
    assert int(locked['Retry-After']) >= 1
    assert locked.json()['message'] == LOCKOUT_MESSAGE


@pytest.mark.django_db
def test_unknown_email_failures_count_toward_the_same_counter(api):
    for _ in range(3):
        response = _login(api, 'ghost@example.com', 'wrong-password')
        assert response.status_code == 401
        assert response.json()['success'] is False

    locked = _login(api, 'ghost@example.com', 'wrong-password')
    assert locked.status_code == 429
    assert locked.json() == {'success': False, 'message': LOCKOUT_MESSAGE}


@pytest.mark.django_db
def test_successful_login_resets_the_counter(api):
    _register(api, 'reset@example.com')

    for _ in range(2):
        assert _login(api, 'reset@example.com', 'wrong-password').status_code == 401

    assert _login(api, 'reset@example.com', 'password').status_code == 200

    # The success cleared the counter: 3 more failures are still plain 401s
    # (without the reset the second one would already be a 429).
    for _ in range(3):
        response = _login(api, 'reset@example.com', 'wrong-password')
        assert response.status_code == 401
        assert response.json()['success'] is False


@pytest.mark.django_db
def test_lockout_is_per_email(api):
    _register(api, 'a@example.com')
    _register(api, 'b@example.com')

    for _ in range(3):
        assert _login(api, 'a@example.com', 'wrong-password').status_code == 401

    assert _login(api, 'a@example.com', 'password').status_code == 429
    assert _login(api, 'b@example.com', 'password').status_code == 200


@pytest.mark.django_db
def test_email_counter_is_normalized(api):
    _register(api, 'cased@example.com')

    for _ in range(3):
        assert _login(api, '  CASED@Example.com ', 'wrong-password').status_code == 401

    locked = _login(api, 'cased@example.com', 'password')
    assert locked.status_code == 429
    assert locked.json()['message'] == LOCKOUT_MESSAGE


@pytest.mark.django_db
def test_login_401_message_is_generic(api):
    _register(api, 'generic@example.com')

    wrong_email = _login(api, 'nobody@example.com', 'wrong-password')
    wrong_password = _login(api, 'generic@example.com', 'wrong-password')

    assert wrong_email.status_code == 401
    assert wrong_password.status_code == 401
    assert wrong_email.json() == wrong_password.json()
    assert 'password' not in wrong_password.json()['message'].lower()


def test_security_headers_on_every_response(api):
    response = api.get('/health')
    assert response.status_code == 200
    assert response['X-Content-Type-Options'] == 'nosniff'
    assert response['X-Frame-Options'] == 'DENY'
    assert response['Referrer-Policy'] == 'no-referrer'
    assert response['Cross-Origin-Opener-Policy'] == 'same-origin'
    assert response['Permissions-Policy'] == 'camera=(), microphone=(), geolocation=()'
    assert response['Content-Security-Policy'] == "default-src 'none'"
    assert not response.has_header('Strict-Transport-Security')

    api_response = api.get('/api/v1/categories')
    assert api_response['Content-Security-Policy'] == "default-src 'none'"


def test_oversized_body_is_rejected_with_standard_envelope(api):
    payload = {'name': 'Big', 'email': 'big@example.com', 'password': 'x' * 200000}
    response = api.post(
        REGISTER_URL,
        json.dumps(payload),
        content_type='application/json',
    )
    body = response.json()
    assert response.status_code == 413
    assert body['success'] is False
    assert body['message'] == 'Request body too large'
    assert 'errors' not in body


def test_global_rate_limit_returns_429_with_retry_after(monkeypatch):
    # The limiter is disabled in the test env, so exercise it directly.
    monkeypatch.setattr(settings, 'RATE_LIMIT_ENABLED', True)
    monkeypatch.setattr(settings, 'RATE_LIMIT_MAX', 3)
    monkeypatch.setattr(settings, 'RATE_LIMIT_WINDOW_MS', 60000)

    def ok_response(request):
        return JsonResponse({'success': True})

    middleware = RateLimitMiddleware(ok_response)
    factory = RequestFactory()

    for _ in range(3):
        assert middleware(factory.post('/api/v1/categories')).status_code == 200

    limited = middleware(factory.post('/api/v1/categories'))
    body = json.loads(limited.content)
    assert limited.status_code == 429
    assert int(limited['Retry-After']) >= 1
    assert body == {'success': False, 'message': 'Too many requests, please try again later'}
    assert 'errors' not in body

    # /health and the route index are exempt.
    assert middleware(factory.get('/health')).status_code == 200
    assert middleware(factory.get('/api/v1')).status_code == 200


@pytest.mark.django_db
def test_cors_allowlist_reflected_with_vary_origin(api):
    response = api.get('/api/v1/categories', HTTP_ORIGIN='http://localhost:3000')
    assert response.status_code == 200
    assert response['Access-Control-Allow-Origin'] == 'http://localhost:3000'
    assert 'origin' in response['Vary'].lower()
    assert response.get('Access-Control-Allow-Credentials') == 'true'

    denied = api.get('/api/v1/categories', HTTP_ORIGIN='https://evil.example.com')
    assert not denied.has_header('Access-Control-Allow-Origin')
