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

## Security

Implements `_SECURITY_SPEC.md` with the same behaviour as the other framework folders.

- **Login attempt limiter** — `POST /api/v1/auth/login` allows **3 failed logins per normalized email (trim + lowercase) per 15 minutes**, plus **10 failed logins per client IP per 15 minutes** (sliding window, in-memory `ConcurrentDictionary` store that prunes expired entries). Only failed credential checks count — unknown email and wrong password alike — and a successful login clears that email's counter. The lock is checked **before** the bcrypt compare, so a locked account returns **429** even with the correct password:

  ```json
  { "success": false, "message": "Too many failed login attempts. Please try again later." }
  ```

  with `Retry-After: <seconds until the oldest failure expires>` (always >= 1) and no `errors` key.
- **Global rate limit** — 300 requests / 60 s per IP on everything except `GET /health` and the route index `GET /api/v1`. Over-limit responses are 429 with the standard envelope and `Retry-After`. Keys: `RateLimit:Enabled` (`RATE_LIMIT_ENABLED`), `RateLimit:PermitLimit` (`RATE_LIMIT_MAX`), `RateLimit:WindowSeconds` (`RATE_LIMIT_WINDOW_MS`). It is **disabled automatically when the environment is `Testing`** so suites never flake.
- **Security headers** on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Content-Security-Policy: default-src 'none'` for the JSON API. The Swagger UI HTML under `/api/v1/docs` (served by this same app) relaxes it to `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:` — noted here as required by the spec. `Strict-Transport-Security: max-age=31536000` is sent only on HTTPS responses and only when `ENABLE_HSTS=true` (default off).
- **No framework fingerprint** — Kestrel's `Server` header is switched off (`AddServerHeader = false`) and `Server`, `X-Powered-By`, `X-Sourcefiles`, `X-AspNet-Version`, `X-AspNetMvc-Version` are stripped when the response starts.
- **CORS** — allowlist only, read from `Cors:Origins` / `CORS_ORIGINS` (default `http://localhost:3000,http://localhost:5173,http://localhost:4200`). Listed origins get `Access-Control-Allow-Credentials: true`; `*` is never combined with credentials. Any header/method, preflight cached for 600 s, and `Vary: Origin` on every response.
- **Body size** — request bodies are capped at 100 kb (`BodyLimit:MaxBytes` / `BODY_LIMIT`) at the Kestrel level and with an app-level `Content-Length` check; an oversize body returns **413** with the standard envelope.
- **Auth hygiene** — wrong email and wrong password share one generic 401 message (`These credentials do not match our records`), and when the email does not exist the submitted password is still run through a bcrypt compare against a fixed dummy hash so timing cannot reveal account existence. Request bodies, passwords, and tokens are never logged; unhandled errors return a sanitized `Internal server error` with the details only in the server log.
- **Proxy trust** — `TRUST_PROXY=false` by default, so `X-Forwarded-For`/`X-Forwarded-Proto` are ignored (limits key on the direct peer address and cannot be spoofed). Set it to `true` behind a reverse proxy on loopback; otherwise every client shares the proxy's IP.
- **Per-process counters** — the login counters and the global limiter live in process memory: they reset on restart and are **not shared between instances**. Scale vertically, or swap the store for Redis when running several replicas.

New environment variables (all optional, defaults shown; `.env` or real process environment, see `.env.example`):

| env | config key | default |
| --- | --- | --- |
| `LOGIN_RATE_LIMIT_MAX` | `LoginRateLimit:MaxAttempts` | `3` |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `LoginRateLimit:WindowSeconds` | `900000` (15 min) |
| `LOGIN_IP_RATE_LIMIT_MAX` | `LoginRateLimit:IpMaxAttempts` | `10` |
| `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `LoginRateLimit:IpWindowSeconds` | `900000` (15 min) |
| `RATE_LIMIT_ENABLED` | `RateLimit:Enabled` | `true` (forced off in `Testing`) |
| `RATE_LIMIT_MAX` | `RateLimit:PermitLimit` | `300` |
| `RATE_LIMIT_WINDOW_MS` | `RateLimit:WindowSeconds` | `60000` |
| `CORS_ORIGINS` | `Cors:Origins` | `http://localhost:3000,http://localhost:5173,http://localhost:4200` |
| `TRUST_PROXY` | `TrustProxy` | `false` |
| `ENABLE_HSTS` | `Hsts:Enabled` | `false` |
| `BODY_LIMIT` (bytes) | `BodyLimit:MaxBytes` | `102400` |

Lockout tests live in `tests/Backend.Api.Tests/LoginRateLimitTests.cs` (3 failures → 401 each, 4th → 429 with `Retry-After >= 1` and no `errors`, correct password while locked, unknown-email counting, reset on success, per-email scope, normalized key) and `SecurityHardeningTests.cs` (headers, CORS allowlist, 100 kb cap). Tests reset the counters through `ILoginAttemptService.Reset()` between cases.

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
