"""Demo seed matches the shared Express dataset."""

from app.services.seed_service import seed_demo_data


def test_seed_counts_and_admin_login(client, app):
    summary = seed_demo_data(reset=True)
    assert summary == {
        "users": 6,
        "categories": 3,
        "tags": 6,
        "products": 10,
        "orders": 10,
        "comments": 15,
    }

    login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "password"})
    assert login.status_code == 200
    assert login.get_json()["data"]["user"]["role"] == "admin"
    assert "password" not in login.get_json()["data"]["user"]

    products = client.get("/api/v1/products?limit=10&sort=id&order=asc")
    names = [row["name"] for row in products.get_json()["data"]]
    assert "Smartphone X Pro" in names
    assert products.get_json()["meta"]["total"] == 10
