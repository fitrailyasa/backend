# Go (Gin)

REST API for the shared starter contract. Gin is the HTTP framework. Persistence uses GORM against the shared MySQL database `backend_starter`, and tests use an in-memory SQLite database.

Product writes accept `tags` (this service's field) and `tag_ids` (the field used by Nest, Laravel, CodeIgniter, and Rails).

## Prerequisites

- Go 1.23 or newer
- MySQL 8 with the `backend_starter` database (see `database/schema.sql`)

## Setup

```powershell
cd go
copy .env.example .env
go mod download
```

`DB_SYNC` stays `false` so this process does not alter tables that the other frameworks already use. Apply `database/schema.sql` yourself only on an empty database.

## Seed

```powershell
go run ./cmd/server seed
```

The seeder inserts the demo catalog only when `admin@example.com` is missing. It does not delete or rewrite existing rows.

Demo login: `admin@example.com` / `password`. Other accounts are `user@example.com` through `user5@example.com`, same password.

## Run

```powershell
go run ./cmd/server
```

- API: http://localhost:8090/api/v1
- Health: http://localhost:8090/health
- Swagger UI: http://localhost:8090/api/v1/docs
- OpenAPI: http://localhost:8090/api/v1/docs.json

`api.http` exercises the same endpoints.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/v1` | public |
| GET | `/api/v1/docs` | public |
| GET | `/api/v1/docs.json` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public |
| POST | `/api/v1/auth/logout` | bearer |
| GET | `/api/v1/auth/me` | bearer |
| GET, POST | `/api/v1/users` | admin |
| GET, PATCH | `/api/v1/users/me` | bearer |
| GET, PUT, PATCH, DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories`, `/api/v1/categories/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/categories/{id}` | admin |
| GET | `/api/v1/products`, `/api/v1/products/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/products/{id}` | admin |
| GET | `/api/v1/tags`, `/api/v1/tags/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/tags/{id}` | admin |
| GET, POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner cancelling a pending order |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/products/{id}/comments` | public |
| POST | `/api/v1/products/{id}/comments` | bearer |
| GET | `/api/v1/comments` | public |
| PATCH, DELETE | `/api/v1/comments/{id}` | owner or admin |

Collection queries: `page`, `limit` (max 100), `search`, `sort`, `order`. Products also accept `category_id`, `tag_id`, `tag`, `min_price`, `max_price`. Optional `include` values are `category` and `tags` on products, `products` on categories, and `items`, `items.product`, `user` on orders.

## Test

```powershell
go test ./...
```

## Security

Implements `_SECURITY_SPEC.md` on top of the shared contract (`_SPEC.md` responses and status codes are unchanged).

**Login lockout** — `POST /api/v1/auth/login` allows **3 failed logins per email per 15 minutes** and **10 failed logins per client IP per 15 minutes**, counted only on failed credential checks (unknown email and wrong password both count) and keyed on the normalized email (trim + lowercase). While the counter is exhausted the endpoint returns `429` with `Retry-After >= 1` and the standard envelope *without* an `errors` key, before any password hashing happens. A successful login clears that email's counter. One generic `401` message covers wrong email and wrong password, and unknown emails are still compared against a fixed dummy bcrypt hash so timing does not reveal which accounts exist.

**Global rate limit** — **300 requests / 60 seconds per IP** on every route except `GET /health` and the route index (`/api/v1`), returning `429` with the standard envelope and `Retry-After`. Auth routes (`register`/`login`/`refresh`) additionally keep their own per-IP counter with the same settings. The limiter is disabled automatically when `APP_ENV=test` (or a Go test binary is running) so suites never flake, and by `RATE_LIMIT_ENABLED=false`.

**Hardening** — every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and `Content-Security-Policy: default-src 'none'`. The one relaxation is the Swagger UI page at `/api/v1/docs`, which gets a CSP scoped to `https://cdn.jsdelivr.net` (the only assets it loads) — the JSON API itself stays at `default-src 'none'`. `Strict-Transport-Security` is only sent when `ENABLE_HSTS=true` **and** the request is HTTPS. No `Server`/`X-Powered-By` fingerprint is emitted. Request bodies are capped at `BODY_LIMIT` (default `100kb`) and oversized payloads still get the standard envelope.

**CORS** — origins are reflected only when listed in `CORS_ORIGINS` (defaults to the dev allowlist `http://localhost:3000,http://localhost:5173,http://localhost:4200`), responses always send `Vary: Origin`, preflights cache for 600s, and credentials are never combined with a `*` origin.

**Proxy trust** — `TRUST_PROXY` (default `false`) controls whether `X-Forwarded-For` is trusted when deriving the client IP; keep it off unless a proxy you control sets the header, otherwise the IP limits can be spoofed (on behind a proxy, or every client shares one IP).

**Caveat: counters are per process.** They live in memory, are lost on restart, and are not shared between instances — scale vertically, or swap the stores for Redis before running multiple workers/instances.

### Environment

| key | default | meaning |
| --- | --- | --- |
| `LOGIN_RATE_LIMIT_MAX` | `3` | failed logins per email before lockout (`0` disables) |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | sliding window for the per-email counter |
| `LOGIN_IP_RATE_LIMIT_MAX` | `10` | failed logins per client IP before lockout (`0` disables) |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `900000` | sliding window for the per-IP counter |
| `RATE_LIMIT_ENABLED` | `true` | master switch for request counting |
| `RATE_LIMIT_MAX` | `300` | global requests per IP per window (`0` disables) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | global window |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` | comma separated CORS allowlist (`CORS_ORIGIN` still honoured) |
| `BODY_LIMIT` | `100kb` | maximum accepted request body size |
| `TRUST_PROXY` | `false` | trust `X-Forwarded-For` for the client IP |
| `ENABLE_HSTS` | `false` | send HSTS on HTTPS requests |
