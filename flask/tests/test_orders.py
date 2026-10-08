"""Users, pagination, and orders."""

from tests.conftest import auth


def test_pagination_meta_and_password_hidden(client, make_user, login):
    admin = make_user(name="Admin", email="admin@example.com", role="admin")
    make_user(name="Regular", email="user@example.com")
    for index in range(12):
        make_user(name=f"Extra {index}")
    token = login(admin.email)["token"]

    response = client.get("/api/v1/users", headers=auth(token))
    body = response.get_json()

    assert response.status_code == 200
    assert body["message"] == "Users retrieved"
    assert len(body["data"]) == 10
    assert body["meta"] == {"page": 1, "limit": 10, "total": 14, "total_pages": 2}
    assert all("password" not in row for row in body["data"])

    capped = client.get("/api/v1/users?limit=500", headers=auth(token))
    assert capped.status_code == 422
    assert isinstance(capped.get_json()["errors"]["limit"], list)


def test_users_me_patch_hides_password(client, make_user, login):
    user = make_user(name="Regular", email="user@example.com")
    token = login(user.email)["token"]

    current = client.get("/api/v1/users/me", headers=auth(token))
    assert current.status_code == 200
    assert current.get_json()["data"]["email"] == "user@example.com"
    assert "password" not in current.get_json()["data"]

    updated = client.patch(
        "/api/v1/users/me",
        json={"name": "Self Updated", "password": "anotherpass", "password_confirmation": "anotherpass", "role": "admin"},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert updated.get_json()["message"] == "Profile updated successfully"
    assert updated.get_json()["data"]["name"] == "Self Updated"
    assert updated.get_json()["data"]["role"] == "user"
    assert "password" not in updated.get_json()["data"]
    assert "$2b$" not in updated.get_data(as_text=True)

    relogin = client.post("/api/v1/auth/login", json={"email": "user@example.com", "password": "anotherpass"})
    assert relogin.status_code == 200


def test_order_total_stock_and_owner_cannot_mark_paid(client, make_user, make_category, make_product, login):
    admin = make_user(name="Admin", email="admin@example.com", role="admin")
    buyer = make_user(name="Buyer", email="buyer@example.com")
    admin_token = login(admin.email)["token"]
    buyer_token = login(buyer.email)["token"]

    category = make_category(name="Electronics")
    phone = make_product(category=category, name="Smartphone", price=250, stock=10)
    cable = make_product(category=category, name="Cable", price=10.5, stock=100)

    created = client.post(
        "/api/v1/orders",
        json={"items": [{"product_id": phone.id, "quantity": 2}, {"product_id": cable.id, "quantity": 3}], "total": 0.01},
        headers=auth(buyer_token),
    )
    body = created.get_json()
    assert created.status_code == 201
    assert body["message"] == "Order created successfully"
    assert body["data"]["status"] == "pending"
    assert body["data"]["total"] == 531.5
    assert body["data"]["user_id"] == buyer.id
    lines = [{"product_id": item["product_id"], "quantity": item["quantity"], "price": item["price"]} for item in body["data"]["items"]]
    assert lines == [
        {"product_id": phone.id, "quantity": 2, "price": 250},
        {"product_id": cable.id, "quantity": 3, "price": 10.5},
    ]
    assert client.get(f"/api/v1/products/{phone.id}").get_json()["data"]["stock"] == 8
    assert client.get(f"/api/v1/products/{cable.id}").get_json()["data"]["stock"] == 97

    merged = client.post(
        "/api/v1/orders",
        json={"items": [{"product_id": phone.id, "quantity": 1}, {"product_id": phone.id, "quantity": 1}]},
        headers=auth(buyer_token),
    )
    assert merged.status_code == 201
    assert merged.get_json()["data"]["total"] == 500
    assert len(merged.get_json()["data"]["items"]) == 1
    assert merged.get_json()["data"]["items"][0]["quantity"] == 2
    assert client.get(f"/api/v1/products/{phone.id}").get_json()["data"]["stock"] == 6

    missing = client.post(
        "/api/v1/orders",
        json={"items": [{"product_id": 999999, "quantity": 1}]},
        headers=auth(buyer_token),
    )
    assert missing.status_code == 404

    short = client.post(
        "/api/v1/orders",
        json={"items": [{"product_id": phone.id, "quantity": 999}]},
        headers=auth(buyer_token),
    )
    assert short.status_code == 409
    assert "Insufficient stock" in short.get_json()["message"]
    assert client.get(f"/api/v1/products/{phone.id}").get_json()["data"]["stock"] == 6

    own = client.get("/api/v1/orders", headers=auth(buyer_token))
    assert own.status_code == 200
    assert own.get_json()["meta"]["total"] == 2
    assert all(row["user_id"] == buyer.id for row in own.get_json()["data"])

    everyone = client.get("/api/v1/orders", headers=auth(admin_token))
    assert everyone.get_json()["meta"]["total"] == 2

    forbidden_filter = client.get(f"/api/v1/orders?user_id={buyer.id}", headers=auth(buyer_token))
    assert forbidden_filter.status_code == 403

    order_id = body["data"]["id"]
    paid = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "paid"}, headers=auth(buyer_token))
    assert paid.status_code == 403
    assert client.get(f"/api/v1/orders/{order_id}", headers=auth(buyer_token)).get_json()["data"]["status"] == "pending"

    admin_paid = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "paid"}, headers=auth(admin_token))
    assert admin_paid.status_code == 200
    assert admin_paid.get_json()["data"]["status"] == "paid"

    cancel = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "cancelled"}, headers=auth(buyer_token))
    assert cancel.status_code == 403

    pending = client.post(
        "/api/v1/orders",
        json={"items": [{"product_id": cable.id, "quantity": 4}]},
        headers=auth(buyer_token),
    )
    pending_id = pending.get_json()["data"]["id"]
    stock_before_cancel = client.get(f"/api/v1/products/{cable.id}").get_json()["data"]["stock"]
    cancelled = client.patch(
        f"/api/v1/orders/{pending_id}/status",
        json={"status": "cancelled"},
        headers=auth(buyer_token),
    )
    assert cancelled.status_code == 200
    assert cancelled.get_json()["data"]["status"] == "cancelled"
    assert client.get(f"/api/v1/products/{cable.id}").get_json()["data"]["stock"] == stock_before_cancel + 4

    restored = client.patch(f"/api/v1/orders/{pending_id}/status", json={"status": "pending"}, headers=auth(admin_token))
    assert restored.status_code == 200
    assert client.get(f"/api/v1/products/{cable.id}").get_json()["data"]["stock"] == stock_before_cancel

    deleted = client.delete(f"/api/v1/orders/{pending_id}", headers=auth(admin_token))
    assert deleted.status_code == 200
    assert deleted.get_json()["message"] == "Order deleted successfully"
    assert client.get(f"/api/v1/products/{cable.id}").get_json()["data"]["stock"] == stock_before_cancel + 4
    assert client.delete(f"/api/v1/orders/{order_id}", headers=auth(buyer_token)).status_code == 403
