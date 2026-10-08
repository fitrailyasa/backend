"""Catalogue slugs, includes, and comments."""

from tests.conftest import auth


def test_category_product_tag_contract(client, make_user, make_category, make_tag, make_product, login):
    admin = make_user(name="Admin", email="admin@example.com", role="admin")
    user = make_user(name="Regular", email="user@example.com")
    admin_token = login(admin.email)["token"]
    user_token = login(user.email)["token"]
    category = make_category(name="Electronics")
    tag = make_tag(name="Featured")
    product = make_product(category=category, name="Smartphone X", price=500, stock=10, description="A phone", tags=[tag.id])

    listed = client.get("/api/v1/categories")
    assert listed.status_code == 200
    assert listed.get_json()["message"] == "Categories retrieved"
    assert listed.get_json()["meta"]["total"] == 1

    created = client.post("/api/v1/categories", json={"name": "Home & Living"}, headers=auth(admin_token))
    assert created.status_code == 201
    assert created.get_json()["data"]["slug"] == "home-living"

    duplicate = client.post("/api/v1/categories", json={"name": "Electronics"}, headers=auth(admin_token))
    assert duplicate.status_code == 409
    assert duplicate.get_json()["success"] is False

    forbidden = client.post("/api/v1/categories", json={"name": "Nope"}, headers=auth(user_token))
    assert forbidden.status_code == 403

    invalid = client.post("/api/v1/categories", json={}, headers=auth(admin_token))
    assert invalid.status_code == 422
    assert isinstance(invalid.get_json()["errors"]["name"], list)

    blocked = client.delete(f"/api/v1/categories/{category.id}", headers=auth(admin_token))
    assert blocked.status_code == 409

    products = client.get("/api/v1/products?include=category,tags")
    assert products.status_code == 200
    assert products.get_json()["data"][0]["category"]["name"] == "Electronics"
    assert products.get_json()["data"][0]["tags"][0]["slug"] == "featured"
    assert products.get_json()["data"][0]["price"] == 500

    by_tag = client.get("/api/v1/products?tag=featured")
    assert by_tag.get_json()["meta"]["total"] == 1
    by_price = client.get("/api/v1/products?min_price=100&max_price=600")
    assert by_price.get_json()["meta"]["total"] == 1

    bad_include = client.get("/api/v1/products?include=supplier")
    assert bad_include.status_code == 422
    assert isinstance(bad_include.get_json()["errors"]["include"], list)

    slug = client.post(
        "/api/v1/products",
        json={"category_id": category.id, "name": "Wireless Earbuds", "price": 49.5, "stock": 30, "tags": [tag.id]},
        headers=auth(admin_token),
    )
    assert slug.status_code == 201
    assert slug.get_json()["data"]["slug"] == "wireless-earbuds"
    assert slug.get_json()["data"]["price"] == 49.5
    assert "password" not in slug.get_data(as_text=True)

    taken = client.post(
        "/api/v1/products",
        json={"category_id": category.id, "name": "Smartphone X", "price": 10},
        headers=auth(admin_token),
    )
    assert taken.status_code == 409

    removed = client.delete(f"/api/v1/products/{product.id}", headers=auth(admin_token))
    assert removed.status_code == 200
    assert client.get(f"/api/v1/products/{product.id}").status_code == 404


def test_comments_are_public_and_owner_guarded(client, make_user, make_category, make_product, login):
    admin = make_user(name="Admin", email="admin@example.com", role="admin")
    author = make_user(name="Author", email="author@example.com")
    stranger = make_user(name="Stranger", email="stranger@example.com")
    admin_token = login(admin.email)["token"]
    author_token = login(author.email)["token"]
    stranger_token = login(stranger.email)["token"]
    category = make_category(name="Electronics")
    product = make_product(category=category, name="Smartphone")
    other = make_product(category=category, name="Laptop")

    created = client.post(
        f"/api/v1/products/{product.id}/comments",
        json={"body": "Battery is amazing"},
        headers=auth(author_token),
    )
    assert created.status_code == 201
    assert created.get_json()["data"]["user_id"] == author.id
    comment_id = created.get_json()["data"]["id"]

    client.post(f"/api/v1/products/{other.id}/comments", json={"body": "On the laptop"}, headers=auth(author_token))

    listing = client.get(f"/api/v1/comments?product_id={product.id}")
    assert listing.status_code == 200
    assert listing.get_json()["message"] == "Comments retrieved"
    assert listing.get_json()["meta"]["total"] == 1
    assert listing.get_json()["data"][0]["body"] == "Battery is amazing"

    searched = client.get(f"/api/v1/products/{product.id}/comments?search=battery&include=user")
    assert searched.status_code == 200
    assert searched.get_json()["meta"]["total"] == 1
    assert searched.get_json()["data"][0]["user"]["email"] == "author@example.com"
    assert "password" not in searched.get_json()["data"][0]["user"]

    hijack = client.patch(f"/api/v1/comments/{comment_id}", json={"body": "Hijacked"}, headers=auth(stranger_token))
    assert hijack.status_code == 403

    edited = client.patch(f"/api/v1/comments/{comment_id}", json={"body": "Edited"}, headers=auth(author_token))
    assert edited.status_code == 200
    assert edited.get_json()["data"]["body"] == "Edited"

    moderated = client.delete(f"/api/v1/comments/{comment_id}", headers=auth(admin_token))
    assert moderated.status_code == 200
    assert client.patch(f"/api/v1/comments/{comment_id}", json={"body": "Ghost"}, headers=auth(admin_token)).status_code == 404
