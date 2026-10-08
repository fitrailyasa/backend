# Backend.Api (.NET 8)

This is a .NET 8 Web API that matches the shared Express contract: a `success` / `message` / `data` envelope, **snake_case** JSON, JWT bearer auth, and the MySQL database `backend_starter`.

## Clean architecture

Four projects. Dependencies only point inward:

| Project | Role |
| --- | --- |
| `src/Backend.Domain` | Entities and enums. No framework dependencies. |
| `src/Backend.Application` | DTOs, service interfaces, FluentValidation validators, pagination. |
| `src/Backend.Infrastructure` | EF Core, MySQL (Pomelo), JWT, bcrypt, seed, migrations. |
| `src/Backend.Api` | Controllers, middleware, `Program.cs`. |
| `tests/Backend.Api.Tests` | `WebApplicationFactory` integration tests + SQLite. |

`Api` references `Application` and `Infrastructure`. `Infrastructure` references `Application` and `Domain`. `Application` references only `Domain`. ASP.NET Identity tables are not used.

## SDK

Requires the .NET SDK 8 (LTS). `global.json` pins `8.0.425` with `rollForward: latestFeature`.

```powershell
winget install --id Microsoft.DotNet.SDK.8 -e --accept-package-agreements --accept-source-agreements
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
dotnet --version
```

## Environment

Copy `.env.example` to `.env` in the `dotnet` folder (this file is not committed). On startup, `DB_*` and `JWT_*` override `appsettings`.

```text
Server=127.0.0.1;Port=3306;Database=backend_starter;User=root;Password=;
```

Create the database once:

```sql
CREATE DATABASE backend_starter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

JWT: `Jwt:Secret` must be at least 32 characters. The access token defaults to 3600 seconds and the refresh token to 604800 seconds. Separate access and refresh secrets are optional (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).

The API listens on `http://localhost:5080` (`Properties/launchSettings.json`, `appsettings.json` `Urls`, and the Kestrel endpoint in Development).

## Migrations

The initial migration is in `src/Backend.Infrastructure/Persistence/Migrations` (`InitialCreate`, with the EF model snapshot): tables `users`, `categories`, `products`, `tags`, `product_tag`, `orders`, `order_items`, `comments`.

Install the local tool once, then apply the schema. MySQL must already be running.

```powershell
dotnet new tool-manifest
dotnet tool install dotnet-ef --version 8.0.11
dotnet ef database update --project src/Backend.Infrastructure --startup-project src/Backend.Api
```

A new migration:

```powershell
dotnet ef migrations add ChangeName --project src/Backend.Infrastructure --startup-project src/Backend.Api --output-dir Persistence/Migrations
```

## Seed

Demo data matches `express/src/seed.js`. It is idempotent: if `admin@example.com` already exists, the seed is skipped (the database is not emptied).

- Admin: `admin@example.com` / `password` / role `admin` / name Site Administrator
- Users: User, User 2, User 3, User 4, User 5 — all use password `password`
- 3 categories, 6 tags, 10 products, 10 orders, 15 comments

```powershell
dotnet run --project src/Backend.Api -- seed
```

Or set `Seed:Enabled` / `SEED_ENABLED=true` so the seed runs at startup.

## Run and test

```powershell
dotnet run --project src/Backend.Api
dotnet test
```

Tests use in-memory SQLite (`appsettings.Testing.json`). They do not need MySQL.

`GET /health` returns `{ status, uptime, timestamp }` without the envelope. Other endpoints live under `api/v1` and use the envelope. Collections include `meta.page`, `meta.limit`, `meta.total`, `meta.total_pages`. `errors` appears only on 422. Delete returns 200, not 204.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/v1` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | refresh token (bearer, `refresh_token`, or `token`) |
| POST | `/api/v1/auth/logout` | bearer access |
| GET | `/api/v1/auth/me` | bearer |
| GET | `/api/v1/users/me` | bearer |
| PATCH | `/api/v1/users/me` | bearer |
| GET/POST | `/api/v1/users` | admin |
| GET/PUT/PATCH/DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories`, `/api/v1/categories/{id}` | public |
| POST/PUT/PATCH/DELETE | `/api/v1/categories...` | admin |
| GET | `/api/v1/tags`, `/api/v1/tags/{id}` | public |
| POST/PUT/PATCH/DELETE | `/api/v1/tags...` | admin |
| GET | `/api/v1/products`, `/api/v1/products/{id}` | public |
| POST/PUT/PATCH/DELETE | `/api/v1/products...` | admin |
| GET | `/api/v1/products/{productId}/comments` | public |
| POST | `/api/v1/products/{productId}/comments` | bearer |
| GET | `/api/v1/orders` | bearer (a non-admin sees only their own orders) |
| POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner only `pending` → `cancelled` |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/comments` | public |
| PATCH/DELETE | `/api/v1/comments/{id}` | owner or admin |

List query: `page` (default 1), `limit` (default 10, max 100), `search`, `sort` (default `id`, whitelist), `order` (`asc`/`desc`, default `desc`). Products: `category_id`, `tag_id`, `tag`, `min_price`, `max_price`. `include`: products `category,tags`; categories `products`; orders `items`, `items.product`, `user`.
