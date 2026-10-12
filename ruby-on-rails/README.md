# Backend Starter — Ruby on Rails (API only)

This API follows the same contract as the other framework folders in the repo. The layout is a normal **Rails 7.2 API-only** application (`--api`), not a mini framework on top of Rack.

Default port **3001** (`rails s -p 3001`). Port 3000 is used by the Express app.

## Architecture

```
app/controllers/application_controller.rb          # global error handler
app/controllers/concerns/authenticatable.rb        # JWT Bearer
app/controllers/concerns/respondable.rb            # success / error envelope
app/controllers/api/v1/*_controller.rb             # resources
app/controllers/health_controller.rb               # GET /health, no envelope
app/models/                                        # ActiveRecord, tables match the contract
app/services/order_checkout.rb                     # total, stock, status
app/services/token_issuer.rb                       # access + refresh JWT
db/migrate/                                        # 8 tables
db/seeds.rb                                        # demo data
config/routes.rb
test/integration/                                  # rails test (SQLite)
```

Passwords are hashed with bcrypt into the `password` column (not `password_digest` / `has_secure_password`). Role and order status use Rails enums. Primary keys are BIGINT. On MySQL, role/status are `ENUM` columns and primary keys are `BIGINT UNSIGNED`. Tests use SQLite so `rails test` does not need a MySQL server; there the same columns become `string` / `bigint`.

## Prerequisites

- Ruby 3.3+ and RubyGems
- Bundler
- MySQL or MariaDB only for development/production (`backend_starter`, charset `utf8mb4` / `utf8mb4_unicode_ci`)
- For tests: the `sqlite3` gem (`:test` group). MySQL is not required

### Windows — install Ruby + DevKit

```powershell
winget install --id RubyInstallerTeam.RubyWithDevKit.3.3 -e --accept-package-agreements --accept-source-agreements
```

The installer places Ruby at `C:\Ruby33-x64`. Open a new terminal, or refresh PATH:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
ruby -v
gem install rails bundler
```

The native `mysql2` gem needs DevKit/MSYS2 from that installer, plus the MySQL client library if you actually connect to MySQL. Tests do not load the MySQL adapter.

## Install

```powershell
cd ruby-on-rails
copy .env.example .env
bundle install
```

If `mysql2` fails to compile because the MySQL client library is missing (common on Windows without Connector/C), skip that group for now. Tests still run because they use SQLite:

```powershell
bundle config set --local without mysql
bundle install
```

After Connector/C or the MariaDB client is installed, restore the gem:

```powershell
bundle config unset --local without
bundle config set --local build.mysql2 --with-mysql-dir=C:\path\to\connector-c
bundle install
```

Fill in `.env` (see the table below). `JWT_SECRET` must be at least 32 characters in production.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Puma port |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL |
| `DB_NAME` | `backend_starter` | Database name |
| `DB_USER` / `DB_PASSWORD` | `root` / empty | Credentials |
| `JWT_SECRET` | dev fallback | HMAC secret. Used when the access/refresh secrets are empty |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | same as `JWT_SECRET` | Separate secrets |
| `JWT_EXPIRES_IN` | `3600` | Access token lifetime (seconds) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token lifetime (seconds) |
| `BCRYPT_ROUNDS` | `10` (tests force 4) | bcrypt cost |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` | CORS origin allowlist, comma separated (`CORS_ORIGIN` still honoured as a legacy fallback) |
| `RATE_LIMIT_ENABLED` | `true` (always off in the test env) | Global request throttle on/off |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Global throttle window |
| `RATE_LIMIT_MAX` | `300` | Requests per IP per window on all routes except `/health`. `0` = off |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Auth POST throttle window |
| `AUTH_RATE_LIMIT_MAX` | `100` | Max POST register/login/refresh per IP. `0` = off |
| `LOGIN_RATE_LIMIT_MAX` | `3` | Failed logins per email before lockout |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Per-email lockout window |
| `LOGIN_IP_RATE_LIMIT_MAX` | `10` | Failed logins per IP before lockout |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `900000` | Per-IP lockout window |
| `BODY_LIMIT` | `100kb` | Max request body; larger bodies get `413` |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` / `X-Forwarded-Proto` (only behind a proxy) |
| `ENABLE_HSTS` | `false` | Send `Strict-Transport-Security` on HTTPS responses |
| `SECRET_KEY_BASE` | dev fallback | Rails secret |

## Database

Development / production (MySQL):

```powershell
bundle exec rails db:create
bundle exec rails db:migrate
bundle exec rails db:seed
```

`db:prepare` combines create + migrate. `db:seed` **empties** the demo tables and fills them again.

Admin login:

```
email    : admin@example.com
password : password
role     : admin
```

Plus 5 users (`user@example.com` … `user5@example.com`, password `password`), 3 categories, 6 tags, 10 products, 10 orders, and 15 comments. Numbers and text match `express/src/seed.js`. Orders are created through checkout (stock decreases, price is snapshotted). Non-pending statuses are written directly, so a `cancelled` order in the seed does **not** restore stock — the same as the Express seeder.

## Run

```powershell
bundle exec rails s -p 3001
```

`config/puma.rb` already uses port 3001, so `bundle exec rails s` is enough. Health check: `GET http://localhost:3001/health`.

## Test

```powershell
bundle exec rails test
```

Rails prepares `db/test.sqlite3` from the migrations. MySQL is not required.

## Envelope

Success: `{ success, message, data }`. Collections add `meta: { page, limit, total, total_pages }`.

Error: `{ success: false, message }`. The `errors` key (`{ field: ["..."] }`) appears only on **422**.

`GET /health` returns `{ status, uptime, timestamp }` without the envelope. A successful `DELETE` is **200** with the envelope.

## Auth

Header `Authorization: Bearer <access token>`.

Claims: `sub` (string id), `role`, `iat`, `exp`, `jti`, `typ` (`access` or `refresh`).

Register/login/refresh return `{ user, token, refresh_token, token_type: "Bearer", expires_in }`. Register always uses `role: user`. Password is at least 8 characters plus `password_confirmation`.

Refresh reads the token from the body `refresh_token`, or the body `token`, or the Bearer header (it must be type `refresh`).

Logout stores the access token `jti` in `Rails.cache` (memory store). The next request with that token is rejected with `401`.

Wrong credentials: `401` `"These credentials do not match our records"`. Duplicate email: `422` with `errors.email` containing `"The email has already been taken."`.

POST `/api/v1/auth/register`, `/login`, and `/refresh` use a simple Rack throttle (`429`). See [Security](#security) for the details.

## Security

**Login lockout.** `POST /api/v1/auth/login` allows **3 failed attempts per normalized email (trim + lowercase) per 15 minutes**, plus **10 failed attempts per client IP per 15 minutes** (`LOGIN_RATE_LIMIT_*` / `LOGIN_IP_RATE_LIMIT_*`). The window is sliding and the counters live in process memory. Only failed credential checks count — an unknown email and a wrong password both count — and a successful login clears that email's counter. While locked (even with the correct password) the endpoint answers `429` with `Retry-After: <seconds>` (always >= 1) and the standard error envelope without an `errors` key: `{ "success": false, "message": "Too many failed login attempts. Please try again later." }`. The lock is checked **before** the password hash is touched.

**Auth POST throttle.** `POST /api/v1/auth/register`, `/login` and `/refresh` additionally share a fixed-window per-IP throttle (`AUTH_RATE_LIMIT_MAX`, default 100 per 15 minutes per IP).

**Global throttle.** All routes except `GET /health` and the `/api/v1` route index get **300 requests / 60s per IP** (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`). It is skipped automatically in the test env and can be turned off with `RATE_LIMIT_ENABLED=false`. Over-limit responses are `429` with the standard envelope and a `Retry-After` header.

**Headers.** Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` and `Content-Security-Policy: default-src 'none'`. The Swagger UI under `/api/v1/docs` is the only HTML served by the app, so it gets a relaxed `default-src 'self'` policy plus the script/style/font sources that UI genuinely needs (inline bootstrap script, vendored bundle, Google Fonts). `Strict-Transport-Security` is only sent on HTTPS responses and only when `ENABLE_HSTS=true`. Framework fingerprints (`Server`, `X-Powered-By`, `X-Runtime`) are stripped.

**CORS.** Explicit allowlist from `CORS_ORIGINS` (comma separated; the legacy `CORS_ORIGIN` is still honoured). Default: `http://localhost:3000,http://localhost:5173,http://localhost:4200`. Only listed origins are reflected, `Vary: Origin` is sent, and the preflight cache is 600s. Credentials are never enabled (the API uses Bearer tokens, not cookies), so `*` is never combined with credentials.

**Bodies.** Requests with a body larger than `BODY_LIMIT` (default `100kb`) are rejected with `413` and the standard error envelope.

**Auth hygiene & logging.** Wrong email and wrong password return the identical generic `401` (`These credentials do not match our records`), and an unknown email is still compared against a fixed dummy bcrypt hash so timing does not reveal whether an account exists. Passwords and tokens are filtered from parameter logs; 500 responses are sanitized (details stay in the server log).

**Proxy trust.** `X-Forwarded-For` / `X-Forwarded-Proto` are dropped unless `TRUST_PROXY=true` (default `false`), so IP-based limits cannot be spoofed by a direct client and HSTS cannot be injected through headers.

**Caveat.** All counters (login lockout, throttles) are kept in process memory, per Puma worker. When running multiple instances, scale vertically or move the stores to Redis — each process keeps its own counters.

## Query

`page` defaults to 1, `limit` defaults to 10 with a maximum of 100, `sort` defaults to `id`, `order` defaults to `desc`, plus `search`.

Product filters: `category_id`, `tag_id`, `tag` (slug), `min_price`, `max_price`.

Include: products `category,tags`; categories `products`; orders `items,items.product,user`.

PUT requires the same fields as create. PATCH changes only the keys that were sent. Optional fields that were not sent are not reset.

The slug is filled from `name` when it is empty. A duplicate slug returns `409`.

Money (`price`, `total`) is sent as a JSON number, not a string.

An order is created from `{ items: [{ product_id, quantity }] }`. The server computes the total, copies the price, merges the same `product_id`, rejects a missing product (`404`) and insufficient stock (`409`), then decreases stock. A user may only change `pending` → `cancelled`. An admin may set any valid status. Cancel restores stock. Leaving `cancelled` decreases stock (not below 0). `DELETE` on an order is admin only; stock is restored unless the order was already `cancelled`.

Comments: a public index, plus `GET/POST /api/v1/products/:product_id/comments`. `PATCH`/`DELETE` on a comment is the owner or an admin only (`403`).

Broken JSON returns `400`. An unhandled error returns `500` with the message `"Internal server error"` (details stay in the log).

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
| GET/POST | `/api/v1/users` | admin |
| GET/PATCH | `/api/v1/users/me` | bearer |
| GET/PUT/PATCH/DELETE | `/api/v1/users/:id` | admin |
| GET | `/api/v1/categories`, `/api/v1/products`, `/api/v1/tags` | public |
| GET | `/api/v1/categories/:id`, `/api/v1/products/:id`, `/api/v1/tags/:id` | public |
| POST/PUT/PATCH/DELETE | categories, products, tags | admin |
| GET/POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/:id` | owner or admin |
| PATCH | `/api/v1/orders/:id/status` | owner (cancel) or admin |
| DELETE | `/api/v1/orders/:id` | admin |
| GET | `/api/v1/comments` | public |
| GET/POST | `/api/v1/products/:product_id/comments` | GET public, POST bearer |
| PATCH/DELETE | `/api/v1/comments/:id` | owner or admin |
