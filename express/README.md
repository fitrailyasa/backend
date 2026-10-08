# Backend Starter — Express 5 + Sequelize 6

A production-quality REST API starter built with **Node.js 24**, native **ESM**, **Express 5**, **Sequelize 6** and **MySQL 8**.

It ships a complete users / catalogue / orders / comments domain with JWT authentication, role-based authorisation, server-side pagination, filtering, sorting, relational eager loading, request validation, rate limiting, an OpenAPI document and a 140 test API suite.

---

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Database](#database)
- [Response envelope](#response-envelope)
- [Status codes](#status-codes)
- [API reference](#api-reference)
- [Query parameters](#query-parameters)
- [Authentication](#authentication)
- [Order lifecycle](#order-lifecycle)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Production checklist](#production-checklist)

---

## Requirements

| Tool     | Version |
| -------- | ------- |
| Node.js  | >= 24   |
| MySQL    | 8.x (MariaDB 10.6+ also works) |

No global installs and no native compilation step are required — the whole dependency tree is pure JavaScript.

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. create your environment file
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env

# 3. create the database
mysql -u root -p -e "CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. create the tables
npm run db:sync

# 5. load demo data
npm run seed

# 6. start the server
npm run dev
```

The API is then reachable at `http://localhost:3000/api/v1`.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1
```

### No MySQL server? Use SQLite

Every layer is dialect agnostic, so you can run the whole API without a database server:

```bash
# in .env
DB_DIALECT=sqlite
DB_STORAGE=./database/dev.sqlite
```

Then run `npm run db:sync && npm run seed && npm run dev`. The two dialects produce byte-identical JSON.

---

## Environment variables

Copy `.env.example` to `.env`. Every value below has a safe default, so an empty `.env` still boots.

### Application

| Variable       | Default                 | Description                                        |
| -------------- | ----------------------- | -------------------------------------------------- |
| `NODE_ENV`     | `development`           | `development` \| `test` \| `production`             |
| `PORT`         | `3000`                  | HTTP port                                           |
| `HOST`         | `0.0.0.0`               | Bind address                                        |
| `API_BASE_URL` | `http://localhost:3000` | Public base URL used in docs metadata               |
| `API_PREFIX`   | `/api/v1`               | Versioned base path                                 |
| `CORS_ORIGIN`  | `*`                     | Comma separated allow-list, or `*`                  |
| `BODY_LIMIT`   | `1mb`                   | Maximum accepted request body                       |
| `LOG_FORMAT`   | `dev`                   | `combined` \| `dev` \| `tiny` \| `short`            |
| `REQUEST_ID_HEADER` | `X-Request-Id`      | Inbound header is echoed back in `X-Request-Id`     |

### Database

| Variable            | Default                  | Description                                    |
| ------------------- | ------------------------ | ---------------------------------------------- |
| `DB_DIALECT`        | `mysql`                  | `mysql` / `mariadb` / `sqlite`                 |
| `DB_HOST`           | `127.0.0.1`              | MySQL host                                     |
| `DB_PORT`           | `3306`                   | MySQL port                                     |
| `DB_NAME`           | `backend_starter`        | Database name                                  |
| `DB_USER`           | `root`                   | Database user                                  |
| `DB_PASSWORD`       | _(empty)_                | Database password                              |
| `DB_CHARSET`        | `utf8mb4`                | MySQL charset                                 |
| `DB_COLLATE`        | `utf8mb4_unicode_ci`     | MySQL collation                                |
| `DB_POOL_MAX`       | `10`                     | Max pool connections                           |
| `DB_POOL_MIN`       | `0`                      | Min pool connections                           |
| `DB_POOL_IDLE`      | `10000`                  | Idle connection lifetime (ms)                  |
| `DB_POOL_ACQUIRE`   | `30000`                  | Max wait for a connection (ms)                 |
| `DB_STORAGE`        | `./database/dev.sqlite`  | SQLite file, or `:memory:`                     |
| `DB_SYNC`           | `true`                   | Run `sequelize.sync()` on boot                 |
| `DB_SYNC_FORCE`     | `false`                  | Drop and recreate tables — never in production |
| `DB_LOGGING`        | `false`                  | Log every SQL statement                         |

### Authentication

| Variable                  | Default                    | Description                                |
| ------------------------- | -------------------------- | ------------------------------------------ |
| `JWT_SECRET`              | placeholder                | Fallback signing key — min 32 characters   |
| `JWT_ACCESS_SECRET`       | _(falls back to `JWT_SECRET`)_ | Access token signing key                |
| `JWT_REFRESH_SECRET`      | _(falls back to `JWT_SECRET`)_ | Refresh token signing key               |
| `JWT_EXPIRES_IN`          | `3600`                     | Access token lifetime in seconds           |
| `JWT_REFRESH_EXPIRES_IN`  | `604800`                   | Refresh token lifetime in seconds          |
| `JWT_ISSUER`              | `backend-starter-express`  | `iss` claim                                |
| `JWT_AUDIENCE`            | `backend-starter-clients`  | `aud` claim                                |
| `BCRYPT_ROUNDS`           | `10`                       | Password hashing cost (use 12 in prod)     |

### Pagination and rate limiting

| Variable                 | Default | Description                              |
| ------------------------ | ------- | ---------------------------------------- |
| `PAGINATION_LIMIT`       | `10`    | Default page size                        |
| `PAGINATION_MAX_LIMIT`   | `100`   | Hard ceiling for `?limit`                |
| `RATE_LIMIT_WINDOW_MS`   | `900000`| Auth rate limit window (15 minutes)      |
| `RATE_LIMIT_MAX`         | `100`   | Auth requests per window — `0` disables  |

---

## Available scripts

| Script              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `npm start`         | Start the server                                         |
| `npm run dev`       | Start with `--watch` auto restart                        |
| `npm test`          | Run the full test suite                                  |
| `npm run test:watch`| Run the suite in watch mode                              |
| `npm run db:sync`   | Create/alter tables via `sequelize.sync()`               |
| `npm run db:reset`  | **Destructive** — drop and recreate all tables           |
| `npm run seed`      | Load demo users, catalogue, orders and comments          |

---

## Database

Eight tables, created by `sequelize.sync()` in development or by applying `database/schema.sql` manually in production.

| Table          | Notes                                                              |
| -------------- | ------------------------------------------------------------------ |
| `users`        | `bcrypt` password, `role` enum (`user`/`admin`), unique email       |
| `categories`   | Unique auto-generated `slug` from `name`                            |
| `products`     | `DECIMAL(12,2)` price, `stock`, belongs to a category               |
| `tags`         | Unique `slug`                                                      |
| `product_tags`| Many-to-many join table                                            |
| `orders`       | `status` enum, `DECIMAL(12,2)` total, belongs to a user            |
| `order_items`  | Price **snapshot** at purchase time, belongs to an order           |
| `comments`     | Belongs to a product and a user                                     |

Delete rules follow the spec: `ON DELETE RESTRICT` for `products.category_id` and `orders.user_id` (returns `409` while referenced), and `ON DELETE CASCADE` for join tables, `order_items` and `comments`.

`database/seed.sql` provides the same demo data as `npm run seed` as raw SQL, for teams that prefer to provision data with their migration tooling.

### Demo credentials

```text
admin@example.com  / password     (role: admin)
user@example.com   / password     (role: user)
user2@example.com   / password     (role: user)
user3@example.com  / password     (role: user)
user4@example.com   / password     (role: user)
user5@example.com    / password     (role: user)
```

---

## Response envelope

Every endpoint wrapped by the API router returns a consistent envelope.

**Single resource**

```json
{
  "success": true,
  "message": "Product retrieved",
  "data": { "id": 1, "name": "Smartphone X Pro", "price": 8990000 }
}
```

**Collection** — `data` is always an array and `meta` carries the pagination block:

```json
{
  "success": true,
  "message": "Products retrieved",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 42, "total_pages": 5 }
}
```

**Validation failure** — `errors` maps a field to an array of messages:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "email": ["Email must be a valid email address"] }
}
```

Two endpoints deliberately return **raw JSON** because the spec defines them that way: `GET /health` returns `{ status, uptime, timestamp }`, and `GET /api/v1/docs.json` returns the OpenAPI document itself.

`password` is never serialised. `User` excludes it through a Sequelize `defaultScope` plus a `toJSON` override, so it is absent from single resources, collections and eager-loaded relations alike.

---

## Status codes

| Code | When                                                        |
| ---- | ----------------------------------------------------------- |
| 200  | Successful read, update or delete                           |
| 201  | Resource created                                            |
| 400  | Malformed JSON or an unparseable payload                    |
| 401  | Missing, malformed, expired or revoked access/refresh token |
| 403  | Authenticated but not allowed (role or ownership)           |
| 404  | Resource does not exist                                      |
| 409  | Duplicate unique value, or a delete blocked by a reference  |
| 422  | Validation failed (`errors` is present)                     |
| 429  | Rate limit exceeded                                         |
| 500  | Unexpected server error                                     |

---

## API reference

Base path: `/api/v1`. Authentication is `Authorization: Bearer <access_token>`.

### Meta endpoints

| Method | Path                  | Auth | Description                              |
| ------ | --------------------- | ---- | ---------------------------------------- |
| GET    | `/health`             | –    | Liveness probe (outside the API prefix)  |
| GET    | `/api/v1`             | –    | API index: version, route map, base URL  |
| GET    | `/api/v1/docs.json`   | –    | OpenAPI 3.0.3 document                   |

### Auth

| Method | Path                 | Auth | Description                                        |
| ------ | -------------------- | ---- | -------------------------------------------------- |
| POST   | `/auth/register`     | –    | Create an account, returns access + refresh tokens   |
| POST   | `/auth/login`        | –    | Exchange credentials for tokens                     |
| POST   | `/auth/refresh`      | yes  | Rotate a refresh token into a new access token       |
| POST   | `/auth/logout`       | yes  | Blacklist the current access token (`jti`)           |
| GET    | `/auth/me`           | yes  | Current user profile                                |

### Users

| Method | Path            | Auth | Description                                     |
| ------ | --------------- | ---- | ----------------------------------------------- |
| GET    | `/users/me`     | yes  | Own profile (no password)                       |
| PATCH  | `/users/me`     | yes  | Update own name/email/password; role is ignored |
| GET    | `/users`        | admin| List all users                                  |
| POST   | `/users`        | admin| Create a user, optionally with `role`           |
| GET    | `/users/:id`    | admin| Fetch one user                                  |
| PUT    | `/users/:id`    | admin| Full update                                     |
| PATCH  | `/users/:id`    | admin| Partial update                                  |
| DELETE | `/users/:id`    | admin| Delete a user                                   |

### Categories

| Method | Path                 | Auth  | Description                        |
| ------ | -------------------- | ----- | ---------------------------------- |
| GET    | `/categories`        | –     | List categories                    |
| GET    | `/categories/:id`    | –     | Fetch one category                 |
| POST   | `/categories`        | admin | Create; `slug` defaults from `name`|
| PUT    | `/categories/:id`    | admin | Full update                        |
| PATCH  | `/categories/:id`    | admin | Partial update                     |
| DELETE | `/categories/:id`    | admin | Delete; `409` if products exist    |

### Products

| Method | Path              | Auth  | Description                                     |
| ------ | ----------------- | ----- | ----------------------------------------------- |
| GET    | `/products`       | –     | List products                                   |
| GET    | `/products/:id`   | –     | Fetch one product                               |
| POST   | `/products`       | admin | Create; accepts `tags: [id]`                    |
| PUT    | `/products/:id`   | admin | Full update                                     |
| PATCH  | `/products/:id`   | admin | Partial update                                  |
| DELETE | `/products/:id`   | admin | Delete; cascades its tags and comments          |

### Tags

| Method | Path            | Auth  | Description             |
| ------ | --------------- | ----- | ----------------------- |
| GET    | `/tags`         | –     | List tags               |
| GET    | `/tags/:id`     | –     | Fetch one tag           |
| POST   | `/tags`         | admin | Create                  |
| PUT    | `/tags/:id`     | admin | Full update             |
| PATCH  | `/tags/:id`     | admin | Partial update          |
| DELETE | `/tags/:id`     | admin | Delete                  |

### Orders

Regular users see only their own orders; admins see all of them.

| Method | Path                   | Auth  | Description                                     |
| ------ | ---------------------- | ----- | ----------------------------------------------- |
| GET    | `/orders`              | yes   | Own orders (all orders for an admin)            |
| POST   | `/orders`              | yes   | Place an order; price and total computed server side |
| GET    | `/orders/:id`          | yes   | Own order (any order for an admin)              |
| PATCH  | `/orders/:id/status`   | yes   | Owners may only cancel a `pending` order        |
| DELETE | `/orders/:id`          | admin | Delete an order                                 |

### Comments

| Method | Path                                | Auth  | Description                    |
| ------ | ----------------------------------- | ----- | ------------------------------ |
| GET    | `/products/:productId/comments`     | –     | Comments for a product         |
| POST   | `/products/:productId/comments`     | yes   | Comment on a product           |
| GET    | `/comments`                         | –     | List all comments              |
| PATCH  | `/comments/:id`                     | yes   | Author or admin                |
| DELETE | `/comments/:id`                     | yes   | Author or admin                |

---

## Query parameters

### Collections

| Parameter | Default | Applies to                          | Notes                                              |
| --------- | ------- | ----------------------------------- | -------------------------------------------------- |
| `page`    | `1`     | all collections                     | 1-based                                             |
| `limit`   | `10`    | all collections                     | Capped at `PAGINATION_MAX_LIMIT` (100)              |
| `search`  | –       | `users`, `categories`, `products`, `comments` | Case-insensitive substring match           |
| `sort`    | `id`    | all collections                     | Unknown field → `422`                              |
| `order`   | `DESC`  | all collections                     | `asc` \| `desc` (case-insensitive)                 |
| `include` | –       | see below                           | Comma separated, unknown value → `422`             |

### Resource filters

| Endpoint         | Filters                                    | `include`            |
| ---------------- | ------------------------------------------ | -------------------- |
| `/users`         | `role`                                     | –                    |
| `/categories`    | –                                          | `products`           |
| `/products`      | `category_id`, `min_price`, `max_price`, `tag_id`, `tag` | `category`, `tags` |
| `/tags`          | –                                          | –                    |
| `/orders`        | `status`, `user_id` (admin only)           | `items`, `items.product`, `user` |
| `/comments`      | `product_id`, `user_id`                    | `user`, `product`    |

`?include=items.product` implies `?include=items`. Passing `?include=user` on `/orders` is safe — the nested `User` still omits `password`.

Passing `user_id` on `/orders` as a non-admin returns `403` rather than silently ignoring the filter.

### Examples

```bash
# second page, ten per page, oldest first, matching "pro"
curl "http://localhost:3000/api/v1/products?page=2&limit=10&sort=price&order=asc&search=pro"

# products in one category within a price band, with relations loaded
curl "http://localhost:3000/api/v1/products?category_id=1&min_price=100000&max_price=2000000&include=category,tags"

# one tag by slug
curl "http://localhost:3000/api/v1/products?tag=wireless-earbuds"

# an order with its line items, each with its product
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/orders/1?include=items,items.product"
```

---

## Authentication

Register or log in, then send the access token on every protected call:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.access_token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/auth/me
```

Access tokens carry a unique `jti` claim. `POST /auth/logout` adds that `jti` to a blacklist, so the token is rejected with `401` on any later request even though it has not expired yet. The blacklist lives in process memory, so it resets on restart — use a shared store (Redis) if you run more than one instance.

`PATCH /users/:id` and `PUT /users/:id` require the `admin` role. A user editing their own record must use `PATCH /users/me`, and neither path lets a caller change their own `role`.

---

## Order lifecycle

```text
pending ──> paid ──> shipped ──> completed
   │
   └──────> cancelled
```

- `POST /orders` reads the current price of each product, stores it as a snapshot on the line item, sums `price × quantity` into `total`, and decrements stock — all inside one transaction. A `total` sent by the client is ignored.
- Insufficient stock aborts the transaction and returns `409` with stock left untouched.
- An owner may move their own order to `cancelled`, and only while it is `pending`. Any other status change by a non-admin returns `403`.
- An admin may set any valid status on any order. Stock follows the direction of the change: moving into `cancelled` restores it, and moving back out of `cancelled` decrements it again.
- Cancelling restores stock. An admin deleting an order that was not cancelled restores it too.

---

## Project structure

```text
express/
├── database/
│   ├── schema.sql            raw MySQL DDL
│   └── seed.sql              raw SQL demo data
├── src/
│   ├── config/
│   │   ├── env.js            validated environment
│   │   ├── database.js       Sequelize instance, dialect switch, sync()
│   │   └── sqlite-driver.js  node:sqlite compatibility layer
│   ├── controllers/          HTTP layer: read req, call service, send response
│   ├── docs/openapi.js       OpenAPI 3.0.3 document
│   ├── middleware/           authenticate, authorize, validate, rateLimit, errorHandler, …
│   ├── models/               8 Sequelize models + associations
│   ├── routes/               routers mounted under the API prefix
│   ├── scripts/sync.js       CLI for db:sync / db:reset
│   ├── services/             business logic, transactions, queries
│   ├── utils/                ApiResponse, ApiError, jwt, password, slugify, pagination
│   ├── validators/           express-validator rule sets
│   ├── app.js                Express app assembly
│   ├── seed.js               cross dialect demo seeder
│   └── server.js             HTTP server and graceful shutdown
├── tests/                    node:test + supertest suites
├── .env.example
└── package.json
```

The layering is strict: **routes → validators → controllers → services → models**. Controllers never touch Sequelize, and services never touch `req`/`res`.

`src/config/sqlite-driver.js` is a small adapter that lets Sequelize's SQLite dialect run on Node's built-in `node:sqlite` module. It needs no native build step, which is what makes `npm install && npm test` work on any platform without a compiler or a prebuilt `sqlite3` binary.

---

## Testing

```bash
npm test
```

The suite uses the built-in `node:test` runner with `supertest` — no extra test framework. `tests/helpers.js` forces `DB_DIALECT=sqlite` against an in-memory database, so the tests need no MySQL server and leave no files behind. The schema is created once when the helper is imported, and each test's `beforeEach` drops and recreates it, so cases never share state.

| File                      | Covers                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `tests/auth.test.js`      | register, login, refresh rotation, logout blacklist, `me`     |
| `tests/users.test.js`     | CRUD, admin authorisation, `me` routes, role-escalation guard  |
| `tests/products.test.js`  | categories, products, tags, joins, filters, includes, conflicts |
| `tests/orders.test.js`    | totals, stock, transactions, ownership, status transitions     |
| `tests/comments.test.js`  | nested listing, CRUD, authorisation, cascade deletes           |
| `tests/helpers.js`        | app import, schema sync, fixtures, login helper                |

Current result: **140 tests, 140 passing, 0 failing** across 34 suites.

---

## Production checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set a unique `JWT_SECRET` of at least 32 random characters
- [ ] Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to different values
- [ ] Raise `BCRYPT_ROUNDS` to `12`
- [ ] Set `DB_SYNC=false` and apply `database/schema.sql` with your migration tool
- [ ] Never set `DB_SYNC_FORCE=true`
- [ ] Replace the seeded demo users, and rotate all demo passwords
- [ ] Restrict `CORS_ORIGIN` to your real front-end origins
- [ ] Move the logout blacklist out of process memory (Redis) if you run multiple instances
- [ ] Serve behind a TLS-terminating reverse proxy, then confirm the `trust proxy` hop count in `src/app.js` matches your topology
