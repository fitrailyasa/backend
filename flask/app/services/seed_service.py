"""Demo data shared with the Express seeder."""

from sqlalchemy import text

from app.extensions import db
from app.services import category_service, comment_service, order_service, product_service, tag_service, user_service
from app.models.order import Order

ADMIN = {"name": "Site Administrator", "email": "admin@example.com", "password": "password", "role": "admin"}

USERS = [
    {"name": "User", "email": "user@example.com", "password": "password", "role": "user"},
    {"name": "User 2", "email": "user2@example.com", "password": "password", "role": "user"},
    {"name": "User 3", "email": "user3@example.com", "password": "password", "role": "user"},
    {"name": "User 4", "email": "user4@example.com", "password": "password", "role": "user"},
    {"name": "User 5", "email": "user5@example.com", "password": "password", "role": "user"},
]

CATEGORIES = [
    {"name": "Electronics", "description": "Phones, laptops, audio and every day gadgets."},
    {"name": "Books", "description": "Fiction, non fiction and academic books."},
    {"name": "Home & Living", "description": "Kitchenware, decoration and furniture."},
]

TAGS = ["Featured", "New Arrival", "Best Seller", "Discount", "Premium", "Eco Friendly"]

PRODUCTS = [
    {"category": "Electronics", "name": "Smartphone X Pro", "price": 8990000, "stock": 40, "description": "6.7 inch AMOLED display with a triple camera."},
    {"category": "Electronics", "name": "Wireless Earbuds Z", "price": 749000, "stock": 120, "description": "Active noise cancelling earbuds with 30 hours of playback."},
    {"category": "Electronics", "name": "Ultra Slim Laptop 14", "price": 15999000, "stock": 25, "description": "14 inch ultrabook with 16GB RAM and 512GB SSD."},
    {"category": "Electronics", "name": "Smart Watch S2", "price": 1299000, "stock": 80, "description": "GPS tracking, heart rate and sleep monitoring."},
    {"category": "Electronics", "name": "Mechanical Keyboard K1", "price": 899000, "stock": 60, "description": "Hot swappable switches with a aluminium frame."},
    {"category": "Books", "name": "The Pragmatic Programmer", "price": 289000, "stock": 200, "description": "A classic guide to software craftsmanship."},
    {"category": "Books", "name": "Clean Architecture", "price": 315000, "stock": 150, "description": "A craftsman guide to software structure and design."},
    {"category": "Books", "name": "Daring Greatly", "price": 199000, "stock": 180, "description": "How to build a remarkable life at work."},
    {"category": "Home & Living", "name": "Cast Iron Skillet 26cm", "price": 349000, "stock": 90, "description": "Pre seasoned skillet, oven safe up to 260C."},
    {"category": "Home & Living", "name": "Linen Table Runner", "price": 129000, "stock": 140, "description": "Hand washed linen runner for a 180cm table."},
]

ORDERS = [
    {"user": 0, "status": "completed", "items": [{"product": 0, "quantity": 1}, {"product": 4, "quantity": 2}]},
    {"user": 1, "status": "shipped", "items": [{"product": 2, "quantity": 1}]},
    {"user": 2, "status": "paid", "items": [{"product": 1, "quantity": 3}]},
    {"user": 3, "status": "pending", "items": [{"product": 5, "quantity": 2}, {"product": 7, "quantity": 1}]},
    {"user": 4, "status": "completed", "items": [{"product": 8, "quantity": 1}]},
    {"user": 0, "status": "cancelled", "items": [{"product": 3, "quantity": 1}]},
    {"user": 1, "status": "paid", "items": [{"product": 6, "quantity": 4}]},
    {"user": 2, "status": "pending", "items": [{"product": 9, "quantity": 2}]},
    {"user": 3, "status": "shipped", "items": [{"product": 0, "quantity": 2}, {"product": 1, "quantity": 1}]},
    {"user": 4, "status": "completed", "items": [{"product": 5, "quantity": 1}, {"product": 8, "quantity": 2}]},
]

COMMENTS = [
    {"product": 0, "user": 1, "body": "Battery life is honestly better than advertised."},
    {"product": 0, "user": 2, "body": "Great phone, only wish the charger was included."},
    {"product": 0, "user": 3, "body": "Camera performs well even at night."},
    {"product": 1, "user": 0, "body": "Comfortable for long listening sessions."},
    {"product": 1, "user": 4, "body": "The case is a little bulky but the sound is excellent."},
    {"product": 2, "user": 2, "body": "Replaced my old laptop and the difference is night and day."},
    {"product": 2, "user": 3, "body": "Keyboard travel is comfortable for long coding sessions."},
    {"product": 3, "user": 1, "body": "Battery lasts about three days with notifications on."},
    {"product": 4, "user": 0, "body": "The tactile feel of these switches is superb."},
    {"product": 4, "user": 2, "body": "Loud enough for an office, not for late night work."},
    {"product": 5, "user": 3, "body": "Still relevant in 2026, highly recommended."},
    {"product": 6, "user": 4, "body": "Changed how I structure my projects."},
    {"product": 7, "user": 1, "body": "A gentle book that rewards a slow reader."},
    {"product": 8, "user": 2, "body": "Pre seasoning works perfectly out of the box."},
    {"product": 9, "user": 0, "body": "Colour matches the photos and it washes well."},
]


def seed_demo_data(reset=True):
    if reset:
        _reset_schema()

    users = [user_service.create_user(**ADMIN)]
    for payload in USERS:
        users.append(user_service.create_user(**payload))

    categories = [category_service.create_category(payload) for payload in CATEGORIES]
    category_by_name = {category.name: category for category in categories}

    tags = [tag_service.create_tag({"name": name}) for name in TAGS]

    products = []
    for payload in PRODUCTS:
        assigned = [tag for index, tag in enumerate(tags) if (index + len(products)) % 3 == 0]
        product = product_service.create_product(
            {
                "category_id": category_by_name[payload["category"]].id,
                "name": payload["name"],
                "description": payload["description"],
                "price": payload["price"],
                "stock": payload["stock"],
                "tags": [tag.id for tag in assigned],
            }
        )
        products.append(product)

    orders = []
    for payload in ORDERS:
        order = order_service.create_order(
            {"items": [{"product_id": products[item["product"]].id, "quantity": item["quantity"]} for item in payload["items"]]},
            users[payload["user"]],
        )
        if payload["status"] != "pending":
            stored = db.session.get(Order, order.id)
            stored.status = payload["status"]
            db.session.commit()
        orders.append(order)

    comments = []
    for payload in COMMENTS:
        comments.append(
            comment_service.create_comment(
                products[payload["product"]].id,
                {"body": payload["body"]},
                users[payload["user"]],
            )
        )

    return {
        "users": len(users),
        "categories": len(categories),
        "products": len(products),
        "tags": len(tags),
        "orders": len(orders),
        "comments": len(comments),
    }


def _reset_schema():
    if db.engine.dialect.name == "sqlite":
        db.session.execute(text("PRAGMA foreign_keys=OFF"))
        db.session.commit()
    db.drop_all()
    db.create_all()
    if db.engine.dialect.name == "sqlite":
        db.session.execute(text("PRAGMA foreign_keys=ON"))
        db.session.commit()
