"""Versioned `/api/v1` blueprint."""

from flask import Blueprint

from app.api.v1.auth import bp as auth_bp
from app.api.v1.categories import bp as categories_bp
from app.api.v1.comments import comments_bp, product_comments_bp
from app.api.v1.index import bp as index_bp
from app.api.v1.orders import bp as orders_bp
from app.api.v1.products import bp as products_bp
from app.api.v1.tags import bp as tags_bp
from app.api.v1.users import bp as users_bp

api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")
api_v1.register_blueprint(index_bp)
api_v1.register_blueprint(auth_bp)
api_v1.register_blueprint(users_bp)
api_v1.register_blueprint(categories_bp)
api_v1.register_blueprint(products_bp)
api_v1.register_blueprint(tags_bp)
api_v1.register_blueprint(orders_bp)
api_v1.register_blueprint(comments_bp)
api_v1.register_blueprint(product_comments_bp)
