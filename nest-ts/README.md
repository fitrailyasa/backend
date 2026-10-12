# Backend Starter — NestJS (TypeScript) + TypeORM + MySQL

A production-ready REST API starter template built with **Node.js >= 20**, **NestJS 11**, **TypeORM 0.3**, and **MySQL 8** (with SQLite support for local dev and testing), implementing the shared API contract in `_SPEC.md`.

Includes full domain support for authentication, users, categories, products, tags, orders, comments, Swagger OpenAPI docs, rate limiting, and an automated Jest test suite.

---

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Database & Migrations](#database--migrations)
- [Response envelope](#response-envelope)
- [Status codes](#status-codes)
- [API reference](#api-reference)
- [Query parameters](#query-parameters)
- [Authentication](#authentication)
- [Security](#security)
- [Testing](#testing)

---

## Requirements

| Tool    | Version |
| ------- | ------- |
| Node.js | >= 20   |
| MySQL   | 8.x (MariaDB 10.6+ or SQLite also supported) |

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. copy environment file
cp .env.example .env    # Windows PowerShell: Copy-Item .env.example .env

# 3. create the database (MySQL)
mysql -u root -p -e "CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. import schema (or set DB_SYNCHRONIZE=true in .env for development)
mysql -u root -p backend_starter < database/schema.sql

# 5. seed demo data
npm run seed
# or: mysql -u root -p backend_starter < database/seed.sql

# 6. run in development mode
npm run start:dev
```

The API will be accessible at:
- **Base API**: `http://localhost:3003/api/v1`
- **Health Check**: `http://localhost:3003/health`
- **Swagger Documentation**: `http://localhost:3003/api/docs`

### Running without MySQL (SQLite fallback)

Set the following in `.env`:
```env
DB_DIALECT=sqlite
DB_STORAGE=./database/dev.sqlite
DB_SYNCHRONIZE=true
```
Then run `npm run seed && npm run start:dev`.

---

## Environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NODE_ENV` | `development` | Application environment (`development`, `production`, `test`) |
| `PORT` | `3003` | Port HTTP server listens on |
| `API_PREFIX` | `api/v1` | Global API prefix (excluding `/health`) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` | CORS allowlist (comma-separated). `*` is honoured through the legacy `CORS_ORIGIN` alias and is never combined with credentials |
| `DB_DIALECT` | `mysql` | Database driver (`mysql` or `sqlite`) |
| `DB_HOST` | `127.0.0.1` | Database host |
| `DB_PORT` | `3306` | Database port |
| `DB_USERNAME` | `root` | Database user |
| `DB_PASSWORD` | `""` | Database password |
| `DB_NAME` | `backend_starter` | Database name |
| `DB_STORAGE` | `:memory:` | SQLite file path (when `DB_DIALECT=sqlite`) |
| `DB_SYNCHRONIZE` | `false` | Auto-sync TypeORM schema on boot (dev only) |
| `DB_SEED` | `false` | Automatically seed demo data if users table is empty |
| `JWT_SECRET` | `change-me-super-secret-access-token` | Secret for signing JWT access tokens |
| `JWT_EXPIRES_IN` | `3600` | Access token lifespan in seconds (1 hour) |
| `JWT_REFRESH_SECRET` | `change-me-super-secret-refresh-token` | Secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token lifespan in seconds (7 days) |
| `LOGIN_RATE_LIMIT_MAX` | `3` | Failed logins allowed per email before a lockout |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Sliding window of the per-email counter (15 min) |
| `LOGIN_IP_RATE_LIMIT_MAX` | `10` | Failed logins allowed per client IP before a lockout |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `900000` | Sliding window of the per-IP counter (15 min) |
| `RATE_LIMIT_ENABLED` | `true` | Global request limiter, forced off when `NODE_ENV=test` |
| `RATE_LIMIT_MAX` | `300` | Requests allowed per IP inside the window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window of the global request limiter (60 s) |
| `BODY_LIMIT` | `100kb` | Maximum request body size (413 above the limit) |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` (turn on only behind a reverse proxy) |
| `ENABLE_HSTS` | `false` | Send `Strict-Transport-Security` on HTTPS requests |

---

## Available scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with file watch
- `npm run build` - Compile TypeScript to `dist/`
- `npm run seed` - Seed demo data
- `npm run typecheck` - Run TypeScript compiler checks without emitting files
- `npm test` - Run unit tests with Jest
- `npm run test:e2e` - Run end-to-end test suite

---

## Database & Migrations

The database schema and demo seeder can be run using SQL files or TypeORM:

- Schema file: [database/schema.sql](file:///c:/Users/ASUS/Documents/GitHub/backend/nest-ts/database/schema.sql)
- Seed file: [database/seed.sql](file:///c:/Users/ASUS/Documents/GitHub/backend/nest-ts/database/seed.sql)

Demo credentials:
```text
Email    : admin@example.com
Password : password
Role     : admin

Email    : user@example.com
Password : password
Role     : user
```

---

## Response envelope

### Single resource (200 / 201)
```json
{
  "success": true,
  "message": "Product retrieved",
  "data": { "id": 1, "name": "Smartphone X Pro" }
}
```

### Paginated collection (200)
```json
{
  "success": true,
  "message": "Products retrieved",
  "data": [ { "id": 1, "name": "Smartphone X Pro" } ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 57,
    "total_pages": 6
  }
}
```

### Error response (4xx / 5xx)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["The email has already been taken."]
  }
}
```

---

## Status codes

| Code | Condition |
| ---- | --------- |
| 200 | GET / PUT / PATCH / DELETE success |
| 201 | Resource successfully created |
| 400 | Bad request / malformed JSON |
| 401 | Unauthenticated / token expired or invalid |
| 403 | Forbidden (insufficient role or not owner) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate slug or deleting category with products) |
| 422 | Validation failure (with `errors` dictionary) |
| 500 | Unhandled internal server error (sanitized) |

---

## API reference

Base URL: `/api/v1`

### Health & Docs
- `GET /health` - Health check `{ status: "ok", uptime, timestamp }`
- `GET /api/v1` - List of all routes
- `GET /api/docs` - Swagger UI

### Authentication
- `POST /api/v1/auth/register` (Public) - `{ name, email, password, password_confirmation }`
- `POST /api/v1/auth/login` (Public) - `{ email, password }`
- `POST /api/v1/auth/refresh` (Bearer) - Rotate tokens
- `POST /api/v1/auth/logout` (Bearer) - Revoke access token
- `GET /api/v1/auth/me` (Bearer) - Profile of logged-in user

### Users (Admin only, except `/users/me`)
- `GET /api/v1/users/me` (Bearer) - Own profile
- `GET /api/v1/users` (Admin) - List users
- `GET /api/v1/users/:id` (Admin) - User details
- `POST /api/v1/users` (Admin) - Create user
- `PUT /api/v1/users/:id` (Admin) - Replace user
- `PATCH /api/v1/users/:id` (Admin) - Update user
- `DELETE /api/v1/users/:id` (Admin) - Delete user

### Categories
- `GET /api/v1/categories` (Public) - List categories
- `GET /api/v1/categories/:id` (Public) - Category details
- `POST /api/v1/categories` (Admin) - Create category
- `PUT /api/v1/categories/:id` (Admin) - Replace category
- `PATCH /api/v1/categories/:id` (Admin) - Update category
- `DELETE /api/v1/categories/:id` (Admin) - Delete category (fails with 409 if products exist)

### Products
- `GET /api/v1/products` (Public) - List products
- `GET /api/v1/products/:id` (Public) - Product details
- `POST /api/v1/products` (Admin) - Create product
- `PUT /api/v1/products/:id` (Admin) - Replace product
- `PATCH /api/v1/products/:id` (Admin) - Update product
- `DELETE /api/v1/products/:id` (Admin) - Delete product

### Tags
- `GET /api/v1/tags` (Public) - List tags
- `GET /api/v1/tags/:id` (Public) - Tag details
- `POST /api/v1/tags` (Admin) - Create tag
- `PUT /api/v1/tags/:id` (Admin) - Replace tag
- `PATCH /api/v1/tags/:id` (Admin) - Update tag
- `DELETE /api/v1/tags/:id` (Admin) - Delete tag

### Orders
- `GET /api/v1/orders` (Bearer) - List orders (user sees own; admin sees all)
- `GET /api/v1/orders/:id` (Bearer) - Order details (owner or admin)
- `POST /api/v1/orders` (Bearer) - Create order `{ items: [{ product_id, quantity }] }`
- `PATCH /api/v1/orders/:id/status` (Bearer) - Change status (owner can only change `pending` -> `cancelled`)
- `DELETE /api/v1/orders/:id` (Admin) - Delete order

### Comments
- `GET /api/v1/products/:productId/comments` (Public) - List comments for product
- `POST /api/v1/products/:productId/comments` (Bearer) - Add comment `{ body }`
- `GET /api/v1/comments` (Public) - List comments (filtered by `?product_id=`)
- `PATCH /api/v1/comments/:id` (Bearer) - Update comment (owner or admin)
- `DELETE /api/v1/comments/:id` (Bearer) - Delete comment (owner or admin)

---

## Query parameters

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `page` | `1` | Page number |
| `limit` | `10` | Records per page (max 100) |
| `search` | - | Text search on name / email / description / body |
| `sort` | `id` | Column to sort on |
| `order` | `desc` | `asc` or `desc` |
| `include` | - | Eager load relations (e.g. `category,tags` on products, `items,user` on orders) |

---

## Authentication

- JWT format: `Authorization: Bearer <token>`
- Token claims: `sub` (user id), `email`, `role`, `iat`, `exp`, `jti`
- Passwords are encrypted using **bcrypt** (minimum 8 characters)
- Password hashes are never returned in any response

---

## Security

Implements `_SECURITY_SPEC.md`. All counters below are **per process**: they are
in-memory and reset on restart. Scale vertically, or swap the store for Redis
when you run more than one instance (the JWT blacklist and the refresh-token
rotation have the same caveat).

### Login attempt limiter (`POST /api/v1/auth/login`)

- **3 failed logins per normalized email** (trim + lowercased) inside a sliding
  **15-minute** window (`LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`).
  `Admin@X.com` and `admin@x.com` share one counter.
- **10 failed logins per client IP** inside a sliding 15-minute window
  (`LOGIN_IP_RATE_LIMIT_MAX`, `LOGIN_IP_RATE_LIMIT_WINDOW_MS`), counting every
  email attempted from that address.
- Only *failed* credential checks are counted - unknown email and wrong password
  alike - and a **successful login clears the counters** of that email (and of
  its own failures from that IP).
- The lock is checked **before** the password hash is verified, so a locked
  account answers `429` even with the correct password:

  ```json
  { "success": false, "message": "Too many failed login attempts. Please try again later." }
  ```

  with `Retry-After: <seconds until the lock expires>` (always >= 1) and no
  `errors` key. Unlocked attempts keep returning the usual generic `401`
  (one identical message for wrong email and wrong password, and an unknown
  email still pays for a dummy bcrypt comparison so the timing cannot reveal
  whether an account exists).
- Tests: `src/common/security/login-rate-limit.store.spec.ts` plus the e2e
  suite `test/login-rate-limit.e2e-spec.ts`; `resetLoginRateLimits()` is called
  from `test/setup-env.ts` so suites stay deterministic.

### Global request rate limit

- **300 requests / 60 s per IP** on every route except `GET /health`
  (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_ENABLED`).
- Over-limit requests get `429` with `Retry-After` and the standard error
  envelope. The limiter is **disabled automatically when `NODE_ENV=test`** so
  test suites never flake.

### Headers & hardening

- Every response carries `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Cross-Origin-Opener-Policy: same-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()` and
  `Content-Security-Policy: default-src 'none'`.
- **Swagger UI exception**: the docs are HTML served from the same process
  (`/api/v1/docs`), so that page (and its static assets) get a relaxed
  `default-src 'self'` policy plus the `'unsafe-inline'`/`'unsafe-eval'` script
  sources, `style-src/img-src/font-src` allowances and `connect-src 'self'`
  that the bundled Swagger UI genuinely needs. Everything else stays
  `default-src 'none'`.
- `Strict-Transport-Security` is sent **only** on HTTPS requests and only when
  `ENABLE_HSTS=true`.
- Framework fingerprint removed: no `X-Powered-By`, no `Server` banner.
- **CORS** allowlist from `CORS_ORIGINS` (defaults
  `http://localhost:3000,http://localhost:5173,http://localhost:4200`), with
  `Vary: Origin` and a 600 s preflight cache. `*` is never combined with
  credentials.
- **Body cap** `BODY_LIMIT` (default `100kb`); oversized payloads answer `413`
  with the standard envelope.
- **Client IP** comes from `req.ip`; `X-Forwarded-For` is ignored unless
  `TRUST_PROXY=true` (otherwise the IP limits would be spoofable - and behind a
  proxy you must enable it or every visitor shares one IP).
- Logging never includes request bodies, passwords or tokens; `500` responses
  stay sanitized (`Internal server error.`) with details only in the server log.
- Tests: `test/security.e2e-spec.ts` (headers, CORS, body cap, sanitized
  errors) and `src/common/security/rate-limit.middleware.spec.ts`.
