# Flask API

REST API for the shared backend starter contract. It follows the same routes, status codes, and JSON envelope as the other framework folders, so a frontend can point at this service without changing its client.

The app is an application factory with blueprints. Requests enter through `/api/v1`, validation is done with Marshmallow, and persistence goes through Flask-SQLAlchemy. Tests run on SQLite in memory. Local development uses MySQL database `backend_starter` (`utf8mb4`).

## Prerequisites

- Python 3.13 (`python` or `py`)
- MySQL or MariaDB only when you want to migrate, seed, or run the server against a real database. The test suite does not need MySQL.

## Setup

From this folder:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` before running against MySQL. At minimum set `DB_PASSWORD` if your server requires one, and replace `JWT_SECRET` with a random string of at least 32 characters.

Create the database once:

```sql
CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port used by `python wsgi.py` |
| `DB_NAME` | `backend_starter` | MySQL schema |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` | `127.0.0.1` / `3306` / `root` / empty | MySQL connection |
| `JWT_SECRET` | change me | HMAC secret. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` fall back to this when empty |
| `JWT_EXPIRES_IN` | `3600` | Access token lifetime in seconds |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token lifetime in seconds |
| `BCRYPT_ROUNDS` | `10` | Password hashing cost |
| `PAGINATION_LIMIT` / `PAGINATION_MAX_LIMIT` | `10` / `100` | Collection page size |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `300` / `60000` | Global per-IP request limit. `RATE_LIMIT_ENABLED=false` disables it (it is off in the test env) |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | `100` / `900000` | Auth-route requests per window. `0` disables the limiter |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | `3` / `900000` | Failed logins per email before lockout |
| `LOGIN_IP_RATE_LIMIT_MAX` / `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `10` / `900000` | Failed logins per client IP before lockout |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` | Allowed browser origins, comma separated (`CORS_ORIGIN` still accepted) |
| `BODY_LIMIT` | `100kb` | Max request body size, `413` above it |
| `TRUST_PROXY` | `false` | Honour `X-Forwarded-For` / `X-Forwarded-Proto` behind a reverse proxy |
| `ENABLE_HSTS` | `false` | Send `Strict-Transport-Security` on HTTPS responses |

See `.env.example` for the full list.

## Migrate

```powershell
flask --app wsgi db upgrade
```

The revision in `migrations/versions` creates `users`, `categories`, `products`, `tags`, `product_tag`, `orders`, `order_items`, and `comments`.

## Seed

```powershell
flask --app wsgi seed
```

`flask seed` drops every table in the configured database and recreates them before inserting data. Use a database dedicated to this app. Do not point it at a schema shared with the other framework folders.

It then inserts the shared demo catalogue:

- `admin@example.com` / `password` / Site Administrator / `admin`
- 5 named users (same password)
- 3 categories, 6 tags, 10 products, 10 orders, 15 comments

## Run

```powershell
flask --app wsgi run --host 0.0.0.0 --port 5000
```

Or:

```powershell
python wsgi.py
```

The liveness probe is `GET http://localhost:5000/health`. The versioned API is `http://localhost:5000/api/v1`.

## Test

```powershell
python -m pytest
```

Pytest uses `TestingConfig`: SQLite `:memory:` with a single shared connection, bcrypt cost 4, and an isolated JWT secret. MySQL is not contacted.

## Security

- **Login attempt limiter** (`POST /api/v1/auth/login`): **3 failed logins per normalized email (trim + lowercase) per 15 minutes**, plus **10 failed logins per client IP per 15 minutes**. Only failed credential checks are counted - unknown email and wrong password both count - and a successful login clears that email's counter. The window slides, so `Retry-After` (seconds, always >= 1) is time until the oldest failure expires.
- While locked the endpoint answers **429** before the password hash is touched (so a correct password is 429 too), with `Retry-After`, the usual `X-RateLimit-*` headers from the auth limiter, and the standard envelope **without** `errors`:

  ```json
  { "success": false, "message": "Too many failed login attempts. Please try again later." }
  ```

- **Global rate limit**: 300 requests / 60 seconds per IP on everything except `GET /health` and the API index (`GET /api/v1`), answered with 429, the standard envelope, and `Retry-After`. Tunable with `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_ENABLED`; disabled automatically in the test env. The auth routes keep their own limit too (`AUTH_RATE_LIMIT_MAX` per endpoint + IP).
- **Security headers** on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Content-Security-Policy: default-src 'none'` for the JSON API. The Swagger UI under `/api/v1/docs` is HTML served from this same app, so it gets a relaxed CSP (`default-src 'self'` plus its inline script/style and `self`/`data:` images and fonts). `Strict-Transport-Security` is only sent when `ENABLE_HSTS=true` and the request is HTTPS. `Server` / `X-Powered-By` fingerprints are stripped from responses, and the Werkzeug dev server no longer announces `Server: Werkzeug/...`.
- **CORS**: never `*` with credentials. `CORS_ORIGINS` (comma separated) defaults to `http://localhost:3000,http://localhost:5173,http://localhost:4200`; only listed origins are reflected, responses carry `Access-Control-Allow-Credentials: true` and `Vary: Origin`, and preflights are cached for 600 s. A bare `*` is ignored in favour of that allowlist.
- **Body cap**: request bodies above `BODY_LIMIT` (default 100kb = 102400 bytes) return 413 with the standard envelope.
- **Auth hygiene**: wrong email and wrong password share one generic 401 message (`These credentials do not match our records`), unknown emails still spend a password-hash comparison against a fixed dummy hash so timing cannot reveal whether an account exists, and no password or token is ever logged or returned (500 bodies stay `Internal server error`, details only in the server log).
- **Proxy trust**: `TRUST_PROXY=false` by default, so `X-Forwarded-For` is ignored and client IPs come from the socket. Turn it on only behind a reverse proxy - otherwise IP limits are spoofable, and leaving it on without one makes every user share the proxy's IP.
- **Counters are per process**: the stores are in memory and prune expired entries as they age out, but they reset on restart and are not shared between workers. Scale vertically or swap the stores for Redis when running multiple instances.

## Architecture

```
wsgi.py                 # WSGI entry
app/__init__.py         # create_app()
app/config.py           # development, production, testing
app/extensions.py       # db, migrate, jwt, cors
app/commands.py         # flask seed
app/common/             # envelope, errors, pagination, auth decorators, slugs
app/models/             # SQLAlchemy models
app/schemas/            # Marshmallow validation (422 errors per field)
app/services/           # queries, stock, tokens, seed data
app/api/v1/             # blueprints, url prefix /api/v1
migrations/             # Alembic revisions
tests/                  # pytest
```

`authenticate` requires `Authorization: Bearer <access token>`. `authorize("admin")` allows only the admin role. Logout stores the access token `jti` in an in-memory denylist until it expires.

Access tokens last `JWT_EXPIRES_IN` seconds (3600). Refresh tokens last `JWT_REFRESH_EXPIRES_IN` seconds (604800). Claims are `sub` (string user id), `role`, `iat`, `exp`, `jti`, and `typ` (`access` or `refresh`). `POST /api/v1/auth/refresh` accepts a refresh token from `Authorization: Bearer`, `refresh_token`, or `token` in the JSON body.

## Response envelope

Success:

```json
{ "success": true, "message": "Product retrieved", "data": {} }
```

Collections always include `meta`: `{ "page", "limit", "total", "total_pages" }`. Page defaults to 1, limit to 10, and limit cannot exceed 100. Sort defaults to `id` descending.

Errors:

```json
{ "success": false, "message": "Validation failed" }
```

`errors` is present only on 422, shaped as `{ "field": ["message"] }`. `GET /health` is the exception: `{ "status": "ok", "uptime", "timestamp" }` with no envelope. DELETE returns 200 with the envelope. Unhandled errors return 500 with `Internal server error` and no stack trace.

Passwords are bcrypt hashes in the `password` column and are omitted from every JSON body. Money fields are JSON numbers.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/v1` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | refresh token |
| POST | `/api/v1/auth/logout` | bearer |
| GET | `/api/v1/auth/me` | bearer |
| GET, POST | `/api/v1/users` | admin |
| GET, PATCH | `/api/v1/users/me` | bearer |
| GET, PUT, PATCH, DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories`, `/api/v1/categories/{id}` | public |
| POST | `/api/v1/categories` | admin |
| PUT, PATCH, DELETE | `/api/v1/categories/{id}` | admin |
| GET | `/api/v1/products`, `/api/v1/products/{id}` | public |
| POST | `/api/v1/products` | admin |
| PUT, PATCH, DELETE | `/api/v1/products/{id}` | admin |
| GET | `/api/v1/tags`, `/api/v1/tags/{id}` | public |
| POST | `/api/v1/tags` | admin |
| PUT, PATCH, DELETE | `/api/v1/tags/{id}` | admin |
| GET, POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner cancelling a pending order |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/comments` | public, filter `product_id` |
| GET | `/api/v1/products/{productId}/comments` | public |
| POST | `/api/v1/products/{productId}/comments` | bearer |
| PATCH, DELETE | `/api/v1/comments/{id}` | owner or admin |

Collection query parameters: `page`, `limit`, `search`, `sort`, `order`. Optional `include`:

- products: `category`, `tags` (filters: `category_id`, `tag_id`, `tag`, `min_price`, `max_price`)
- categories: `products`
- orders: `items`, `items.product`, `user` (filters: `status`, and `user_id` for admins)
- comments: `user`, `product`

Order totals are computed on the server from current product prices. Line prices are snapshotted. Duplicate products in one order are merged. Missing products return 404. Insufficient stock returns 409 and does not change stock. Cancelling an order restores stock. Moving a cancelled order back to another status decrements stock again, and stock never goes below 0. Deleting an order restores stock unless it was already cancelled.

Slugs are generated from the name when omitted. An explicit duplicate slug returns 409. Register always creates role `user`. A duplicate email returns 422 with `The email has already been taken.` A bad login returns 401 with `These credentials do not match our records`.
