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
| `CORS_ORIGIN` | `*` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `100` (register, login, refresh) |

Spring reads these values through `application.yml` (`${ENV}`). A `.env` file in the working directory is loaded only for keys that are not already set in the environment.

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
