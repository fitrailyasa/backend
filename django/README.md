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

## Security

Implements `_SECURITY_SPEC.md`:

- **Login lockout**: `POST /api/v1/auth/login` allows **3 failed logins per normalized email
  (trim + lowercase) per 15 minutes** and **10 failed logins per client IP per 15 minutes**. Only
  failed credential checks count (unknown email and wrong password both count); a successful login
  clears that email's counter. When locked the request is rejected **before** the password hash is
  touched: `429` + `Retry-After: <seconds>` with the standard error envelope (no `errors` key) and
  the message `Too many failed login attempts. Please try again later.` — even with the correct
  password. The window is sliding and the store prunes expired entries.
- **Global rate limit**: 300 requests / 60s per IP on every route except `/health` and `/api/v1`
  (429 + `Retry-After` + standard envelope). Automatically disabled under pytest so suites never
  flake. The older per-route limiter on register/login/refresh stays and shares `RATE_LIMIT_*`.
- **Security headers** on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()` and
  `Content-Security-Policy: default-src 'none'` for the JSON API. The Swagger UI at
  `/api/v1/docs` is HTML served from this same app, so that one path relaxes the CSP to
  `default-src 'self'` plus `'unsafe-inline'` scripts/styles and `img-src 'self' data:` that the UI
  genuinely needs. `Strict-Transport-Security` is only sent for HTTPS requests when `ENABLE_HSTS=true`.
- **Fingerprint**: `Server` / `X-Powered-By` style framework headers are stripped from responses.
- **CORS**: a concrete allowlist from `CORS_ORIGINS` (default
  `http://localhost:3000,http://localhost:5173,http://localhost:4200`), never `*` together with
  credentials (`*` falls back to the dev allowlist), with `Vary: Origin` and a 600s preflight cache.
- **Body cap**: request bodies over `BODY_LIMIT` (default 100kb) are rejected with `413` and the
  standard envelope.
- **Auth hygiene**: wrong email and wrong password return the same generic 401 message, and unknown
  emails still run a password-hash comparison against a fixed dummy hash so timing does not reveal
  account existence. Passwords/tokens/request bodies are never logged; unhandled 500s return a
  sanitized message (details go to the server log only).
- **Proxy trust**: `TRUST_PROXY=false` by default, so `X-Forwarded-For`/`X-Forwarded-Proto` are
  ignored (spoof-proof); enable it only behind a reverse proxy — it then also sets
  `SECURE_PROXY_SSL_HEADER` so HTTPS detection honours `X-Forwarded-Proto`.

Counters are **per process** (in-memory): they do not span multiple workers/instances and reset on
restart. Scale vertically or swap the store for Redis when running multiple instances.

| Env var | Default | Meaning |
| --- | --- | --- |
| `RATE_LIMIT_ENABLED` | `true` (off under pytest) | Global limiter on/off |
| `RATE_LIMIT_MAX` | `300` | Global requests per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Global window |
| `LOGIN_RATE_LIMIT_MAX` | `3` | Failed logins per email before lockout |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Per-email window (15 min) |
| `LOGIN_IP_RATE_LIMIT_MAX` | `10` | Failed logins per IP before lockout |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `900000` | Per-IP window (15 min) |
| `BODY_LIMIT` | `102400` | Max request body in bytes (0 disables) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` | CORS allowlist |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For`/`X-Forwarded-Proto` |
| `ENABLE_HSTS` | `false` | Send HSTS on HTTPS responses |

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
