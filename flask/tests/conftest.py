"""Pytest fixtures. The app uses SQLite in memory, not MySQL."""

import itertools

import pytest

from app import create_app
from app.common.rate_limit import clear_rate_limits
from app.config import TestingConfig
from app.extensions import db, jwt

_seq = itertools.count(1)


@pytest.fixture
def app():
    application = create_app(TestingConfig)

    @application.get("/__test_error")
    def _boom():
        raise RuntimeError("secret stack detail")

    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def _reset_memory():
    jwt.clear_blacklist()
    clear_rate_limits()
    yield
    jwt.clear_blacklist()
    clear_rate_limits()


@pytest.fixture
def make_user(app):
    from app.services.user_service import create_user

    def _make(**overrides):
        number = next(_seq)
        return create_user(
            name=overrides.get("name", "Test User"),
            email=overrides.get("email", f"user{number}@example.com"),
            password=overrides.get("password", "password"),
            role=overrides.get("role", "user"),
        )

    return _make


@pytest.fixture
def make_category(app):
    from app.services.category_service import create_category

    def _make(**overrides):
        number = next(_seq)
        return create_category({"name": overrides.get("name", f"Category {number}"), "description": overrides.get("description")})

    return _make


@pytest.fixture
def make_tag(app):
    from app.services.tag_service import create_tag

    def _make(**overrides):
        number = next(_seq)
        return create_tag({"name": overrides.get("name", f"Tag {number}")})

    return _make


@pytest.fixture
def make_product(app, make_category):
    from app.services.product_service import create_product

    def _make(**overrides):
        number = next(_seq)
        category = overrides.get("category") or make_category()
        payload = {
            "category_id": category.id,
            "name": overrides.get("name", f"Product {number}"),
            "price": overrides.get("price", 100),
            "stock": overrides.get("stock", 50),
            "description": overrides.get("description"),
        }
        if "tags" in overrides:
            payload["tags"] = overrides["tags"]
        return create_product(payload)

    return _make


@pytest.fixture
def login(client):
    def _login(email, password="password"):
        response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.get_json()
        return response.get_json()["data"]

    return _login


def auth(token):
    return {"Authorization": f"Bearer {token}"}
