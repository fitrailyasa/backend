"""Integration coverage for register, list-query, and category validation."""

from tests.conftest import auth


def test_register_list_query_and_category_writes_are_validated(client, make_user, login):
    invalid = client.post(
        "/api/v1/auth/register",
        json={
            "name": "A",
            "email": "bad",
            "password": "short",
            "password_confirmation": "nope",
        },
    )
    assert invalid.status_code == 422
    for field in ("name", "email", "password", "password_confirmation"):
        assert isinstance(invalid.get_json()["errors"][field], list)

    listed = client.get(
        "/api/v1/categories",
        query_string={"page": "0", "limit": "0", "sort": "nope", "order": "sideways", "include": "nope"},
    )
    assert listed.status_code == 422
    for field in ("page", "limit", "sort", "order", "include"):
        assert isinstance(listed.get_json()["errors"][field], list)

    anonymous = client.post("/api/v1/categories", json={"name": "Valid Name"})
    assert anonymous.status_code == 401

    admin = make_user(name="Query Admin", email="query-admin@example.com", role="admin")
    token = login(admin.email)["token"]
    rejected = client.post(
        "/api/v1/categories",
        json={"name": "X", "slug": "Bad Slug"},
        headers=auth(token),
    )
    assert rejected.status_code == 422
    assert isinstance(rejected.get_json()["errors"]["name"], list)
    assert isinstance(rejected.get_json()["errors"]["slug"], list)

    created = client.post(
        "/api/v1/categories",
        json={"name": "Valid Category Name"},
        headers=auth(token),
    )
    assert created.status_code == 201
    assert created.get_json()["data"]["slug"] == "valid-category-name"
