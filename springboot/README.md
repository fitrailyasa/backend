# Backend Starter — Spring Boot

This API follows the shared contract used by the other framework folders.
Base package: `com.backend.starter`, organized **package-by-feature** (entity, repository, service, controller, and dto live inside each feature).

## Prerequisites

- JDK 21. `JAVA_HOME` must point at the JDK folder (`mvnw.cmd` refuses to run when `JAVA_HOME` is empty).
- Maven Wrapper (`mvnw.cmd`) — a global Maven install is not required
- MySQL or MariaDB to run the application (not required for tests)
- Tests use H2, so MySQL does not need to be installed for `mvnw test`

JDK 21 and the Maven Wrapper are enough to build and test. MySQL or MariaDB is required only when you run the app against the real database. `mvnw test` uses H2.

## Run

```powershell
copy .env.example .env
# create the database: CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
.\mvnw.cmd spring-boot:run
```

Server: `http://localhost:8080` (no context path).

Flyway runs `src/main/resources/db/migration/V1__init.sql` when the application starts. Do not use `ddl-auto` to change tables; Flyway owns the schema.

Demo seed (idempotent, skipped when `admin@example.com` already exists):

```powershell
$env:APP_SEED="true"
.\mvnw.cmd spring-boot:run
```

Or the Spring profile `seed`. Demo passwords are hashed with bcrypt at runtime.

Admin login: `admin@example.com` / `password`.

## Test

```powershell
.\mvnw.cmd test
```

The `test` profile uses H2 (`MODE=MySQL`) and the script `src/test/resources/db/test-migration/V1__init.sql`. H2 does not support `ENUM` or `BIGINT UNSIGNED`, so that script uses equivalent types. The production schema stays in the MySQL file under `db/migration`.

## Environment

| Variable | Default |
| --- | --- |
| `PORT` | `8080` |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `backend_starter` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | empty |
| `JWT_SECRET` | placeholder (at least 32 characters in production) |
| `JWT_ACCESS_SECRET` | empty, falls back to `JWT_SECRET` |
| `JWT_REFRESH_SECRET` | empty, falls back to `JWT_SECRET` |
| `JWT_EXPIRES_IN` | `3600` |
| `JWT_REFRESH_EXPIRES_IN` | `604800` |
| `JWT_ISSUER` | `backend-starter` |
| `JWT_AUDIENCE` | `backend-starter-clients` |
| `APP_SEED` | `false` |
| `BCRYPT_ROUNDS` | `10` |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` (comma separated; legacy `CORS_ORIGIN` still read, a bare `*` falls back to this allowlist) |
| `RATE_LIMIT_ENABLED` | `true` (global limiter, skipped automatically in the `test` profile) |
| `RATE_LIMIT_MAX` | `300` (global, per IP) |
| `RATE_LIMIT_WINDOW_MS` | `60000` (global) |
| `AUTH_RATE_LIMIT_MAX` | `100` (auth routes register/login/refresh, per IP per endpoint) |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` |
| `LOGIN_RATE_LIMIT_MAX` | `3` (failed logins per normalized email) |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` |
| `LOGIN_IP_RATE_LIMIT_MAX` | `10` (failed logins per client IP) |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `900000` |
| `TRUST_PROXY` | `false` (only then is `X-Forwarded-For` trusted) |
| `ENABLE_HSTS` | `false` (HSTS is sent only when this is `true` **and** the request is HTTPS) |
| `BODY_LIMIT` | `102400` (max request body in bytes, 100kb) |

Spring reads these values through `application.yml` (`${ENV}`). A `.env` file in the working directory is loaded only for keys that are not already set in the environment.

## Security

Implemented from `_SECURITY_SPEC.md` (details and tunables are in the environment table above):

- **Login attempt limiter** — `POST /api/v1/auth/login` allows **3 failed logins per normalized email (trim + lowercase) per 15 minutes**, plus **10 failed logins per client IP per 15 minutes**, as sliding windows in memory (expired entries are pruned, so the stores stay bounded). Only failed credential checks count — unknown email and wrong password both count — and a successful login clears that email's counter. The lock is checked **before** the password hash is verified. While locked, every attempt (including a correct password) gets `429` with `Retry-After: <seconds until the oldest failure expires>` (always >= 1) and the standard envelope without an `errors` key:

  ```json
  { "success": false, "message": "Too many failed login attempts. Please try again later." }
  ```

- **Global request limit** — 300 requests / 60s per IP on everything except `/health` and the API index (`/api/v1`), over-limit responses are `429` with `Retry-After` and the standard envelope. The limiter is skipped automatically in the `test` profile so suites cannot flake. The pre-existing stricter limit on the auth routes (100 / 15 min per IP per endpoint, `AUTH_RATE_LIMIT_*`) is kept.
- **Security headers on every response** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Content-Security-Policy: default-src 'none'` for the JSON API. The self-hosted Swagger UI page (`/api/v1/docs`, and its webjar assets under `/webjars`) is HTML served from this app, so those paths use a relaxed `default-src 'self'` policy plus `script-src/style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `font-src 'self' data:`, `connect-src 'self'`. `Strict-Transport-Security` is only written when `ENABLE_HSTS=true` **and** the request is HTTPS.
- **Fingerprint removal** — `Server`, `X-Powered-By` and `X-Application-Context` are stripped from responses.
- **CORS** — explicit origin allowlist from `CORS_ORIGINS` (dev defaults `http://localhost:3000,http://localhost:5173,http://localhost:4200`); a bare `*` is never used, credentials are not allowed, `Vary: Origin` is always present, preflight results are cached for 600s.
- **Body size cap** — JSON bodies over 100kb (`BODY_LIMIT`, in bytes) are rejected with `413` and the standard envelope before the body is read; multipart uploads use the same cap via `spring.servlet.multipart`.
- **Auth hygiene** — one generic `401` message for both wrong email and wrong password, and when the email does not exist the password is still compared against a fixed dummy bcrypt hash so timing cannot reveal account existence. Passwords and tokens are never logged.
- **Proxy trust** — `X-Forwarded-For` is only honoured when `TRUST_PROXY=true`, otherwise IP-keyed limits would be spoofable (and with it on by default every user would share one IP).
- **500s** stay sanitized (`Internal server error`); stack traces only go to the server log.

### Per-process counters

All limiters (global, auth routes, login attempts) live in process memory: counters reset on restart and are **not shared between instances**. Scale vertically or swap the stores for Redis when running more than one process/replica. Tests reset the login counters through `LoginAttemptService.resetLoginRateLimits()`.

## Layout

```
com.backend.starter
  common/     envelope, error, slug, pagination
  config/     security, CORS, properties
  security/   JWT, blacklist, rate limit
  user/       auth + users
  catalog/    categories, products, tags
  order/
  comment/
  health/
  seed/
```

Table and column names are set explicitly (`users`, `created_at`, …). Hibernate's `CamelCaseToUnderscoresNamingStrategy` does not add another plural form.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public, no envelope |
| GET | `/api/v1` | public, route index |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | refresh token (Bearer or JSON `refresh_token` / `token`) |
| POST | `/api/v1/auth/logout` | bearer access |
| GET | `/api/v1/auth/me` | bearer |
| GET, POST | `/api/v1/users` | admin |
| GET, PATCH | `/api/v1/users/me` | bearer |
| GET, PUT, PATCH, DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories`, `/api/v1/categories/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/categories...` | admin |
| GET | `/api/v1/products`, `/api/v1/products/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/products...` | admin |
| GET | `/api/v1/tags`, `/api/v1/tags/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/tags...` | admin |
| GET, POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner only `pending` → `cancelled` |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/products/{productId}/comments` | public |
| POST | `/api/v1/products/{productId}/comments` | bearer |
| GET | `/api/v1/comments` | public |
| PATCH, DELETE | `/api/v1/comments/{id}` | owner or admin |

Success envelope: `{success, message, data}`. Collections add `meta {page, limit, total, total_pages}`. Errors: `{success:false, message}`. The `errors` field appears only on 422. DELETE returns 200 with `data: null`.

Collection query: `page` (1), `limit` (10, max 100), `search`, `sort` (default `id`, whitelist), `order` (`asc` \| `desc`, default `desc`).

`include`: products `category,tags`; categories `products`; orders `items,items.product,user`; comments `user,product`.

Product filters: `category_id`, `tag_id`, `tag` (slug), `min_price`, `max_price`.
Order filters: `status`, `user_id` (admin). A regular user only sees their own orders.
