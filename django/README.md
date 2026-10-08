# Backend Starter — Django

Django REST API that follows the same contract as the other framework folders in this repo.
Base path: `/api/v1`. Health check: `GET /health`.

## Prerequisites

- Python 3.13 (`python` or `py`)
- MySQL or MariaDB for runtime (database `backend_starter`, charset `utf8mb4`)
- pytest uses SQLite automatically. If MySQL is not installed, set `DB_DIALECT=sqlite` for development.

## Setup

```powershell
cd django
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env` (on a shared machine, at least change `DJANGO_SECRET_KEY` and `JWT_SECRET`).

Create the MySQL database once:

```sql
CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Migrate, seed, run

```powershell
python manage.py migrate
python manage.py seed
python manage.py runserver 0.0.0.0:8000
```

Without MySQL:

```powershell
$env:DB_DIALECT = "sqlite"
python manage.py migrate
python manage.py seed
python manage.py runserver 0.0.0.0:8000
```

`seed` clears the demo data and fills it again (safe to run again). `python manage.py seed --no-reset` skips the process when `admin@example.com` already exists.

Admin login: `admin@example.com` / `password`.

## Test

```powershell
python -m pytest
```

Tests use in-memory SQLite (`config.settings.test`) and do not need MySQL.

## Architecture

```
config/            settings (base, development, test), urls, wsgi/asgi
apps/core/         envelope, error handler, pagination, slug, health
apps/accounts/     user + JWT (register, login, refresh, logout, me, admin CRUD)
apps/catalog/      categories, products, tags, product_tag
apps/orders/       orders + order_items, stock
apps/comments/     comments
tests/             pytest
```

Passwords are hashed with bcrypt (`PASSWORD_HASHERS`) and stored in a column named exactly `password`. That field is never included in a response.

Logout blacklists the access token `jti` **in process memory** until `exp`. Restarting the server clears that list.

## Schema differences

The spec uses an `UNSIGNED` BIGINT primary key. Django uses a **signed** `BigAutoField`. The values still fit the ids this app uses. `role` and `status` are `ENUM` on MySQL and `VARCHAR` on SQLite.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/v1` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | refresh token (Bearer, `refresh_token`, or `token`) |
| POST | `/api/v1/auth/logout` | bearer |
| GET | `/api/v1/auth/me` | bearer |
| GET, POST | `/api/v1/users` | admin |
| GET, PATCH | `/api/v1/users/me` | bearer |
| GET, PUT, PATCH, DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories` | public |
| GET | `/api/v1/categories/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/categories` and `/{id}` | admin |
| GET | `/api/v1/products` | public |
| GET | `/api/v1/products/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/products` and `/{id}` | admin |
| GET | `/api/v1/tags` | public |
| GET | `/api/v1/tags/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/tags` and `/{id}` | admin |
| GET, POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner only `pending` → `cancelled` |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/comments` | public (`product_id`) |
| GET | `/api/v1/products/{productId}/comments` | public |
| POST | `/api/v1/products/{productId}/comments` | bearer |
| PATCH, DELETE | `/api/v1/comments/{id}` | owner or admin |

Collection query: `page` (1), `limit` (10, max 100), `search`, `sort` (default `id`, unknown columns are ignored), `order` (`desc`).

Include: products `category,tags`; categories `products`; orders `items,items.product,user`.
