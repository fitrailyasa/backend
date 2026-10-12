## Backend Starter API

This CodeIgniter 4.7 project implements the shared contract in [`../_SPEC.md`](../_SPEC.md). Requirements: PHP 8.2+, Composer, MySQL 8 or MariaDB 10.6+, and the `intl`, `mbstring`, `json`, and `mysqli` extensions.

### Setup

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
php spark key:generate
```

Create the `backend_starter` database with `utf8mb4_unicode_ci`, configure the database credentials in `.env`, and set `JWT_SECRET` to a unique random value with at least 32 characters. Then run:

```sh
php spark migrate --all
php spark db:seed DatabaseSeeder
php spark serve
```

API base: `http://localhost:8080/api/v1`. Demo admin: `admin@example.com` / `password`; all demo users use password `password`. Access and refresh tokens expire in 3600 and 604800 seconds by default. The CI cache stores revoked token IDs.

### Endpoint coverage

- Auth: register, login, refresh, logout, current user
- Users: admin CRUD; current profile at `/users/me`
- Categories, products, tags: public reads and admin CRUD
- Orders: authenticated owner/admin reads and create, status transition, admin delete
- Comments: public product comments; authenticated create; owner/admin update and delete
- Health: `/health`; API route index: `/api/v1`

Collection endpoints support `page`, `limit` (max 100), `search`, `sort`, and `order`; products support category/tag/price filters and resources support the documented `include` relations. Responses use the shared envelope and omit password fields. Run tests with `composer test`.

## Security

Implemented in `app/Libraries/RateLimiter.php`, `app/Filters/*`, and `app/Config/{RateLimit,Security,Cors,App}.php` (see `../_SECURITY_SPEC.md`).

### Login attempt limiter

- **3 failed attempts per normalized email per 15 minutes** and **10 failed attempts per client IP per 15 minutes**, both sliding windows.
- Only failed credential checks count (unknown email or wrong password); a successful login resets that email's counter. The lock is checked **before** password hashing, so a locked account does no bcrypt work.
- Locked requests get `429` with the standard error envelope (no `errors` key), message `Too many failed login attempts. Please try again later.`, and a `Retry-After` header of at least 1 second. The same envelope is used whether the per-email or the per-IP limit tripped.
- Deliberately generic `401` (`These credentials do not match our records`) for both unknown email and wrong password, and login compares against a fixed dummy bcrypt hash when the email is unknown so response timing does not leak account existence.
- Enforced by the `loginratelimit` route filter on `POST api/v1/auth/login`; `RateLimiter::resetLoginRateLimits()` is the hook used by tests.
- **Counter storage**: the counts are held by the framework cache service (file handler, `writable/cache/security_ratelimit_*`) rather than PHP statics — PHP throws class statics away at the end of every request, so a memory-only counter would never accumulate across HTTP requests. Each operation prunes expired timestamps and emptied keys, the blob carries a TTL equal to its window, one key never keeps more than its own limit of timestamps, and a blob past 1000 live keys drops its least recently failing ones, so the store cannot grow forever. An exclusive lock file serialises the read-modify-write, so parallel brute-force requests handled by different workers cannot drop each other's failures.

### Global rate limit

- **300 requests per 60 seconds per IP**, tunable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`, master switch `RATE_LIMIT_ENABLED`.
- Automatically disabled when `CI_ENVIRONMENT`/`ENVIRONMENT` is `testing`, so the suite never flakes.
- `/health` and the route index `/api/v1` are exempt.
- Exceeding it returns `429` with the standard envelope, message `Too many requests, please try again later`, and `Retry-After`.

### Request hardening

- **Security headers on every response** (including 401/429/404/500 paths): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **CSP**: API responses use `default-src 'none'`. The welcome page (`/`) and the Swagger UI (`/api/v1/docs*`) relax this to `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` — the UI relaxation is deliberate because Swagger UI ships inline scripts.
- **HSTS** (`max-age=15552000`) is sent only when `ENABLE_HSTS = true` *and* the request is HTTPS; keep it off while developing over plain HTTP.
- **Fingerprint removal**: `X-Powered-By`, `Server`, and `X-AspNet-Version` are stripped from responses and `expose_php` headers are removed. The PHP-emitted `Server` header can only be fully silenced at the infrastructure level (`expose_php = Off` in `php.ini`, or a `server_tokens off;` / `Server` header strip in nginx/Apache).
- **CORS allowlist**: origins come from `CORS_ORIGINS` (comma-separated; `*` is rejected), defaulting to `http://localhost:3000,http://localhost:5173,http://localhost:4200`. Credentials are allowed, `Retry-After` is exposed, preflights are cached for 600 seconds, and responses carry `Vary: Origin` so shared caches cannot mix origins. The CORS filter runs as a *required before* filter so preflight `OPTIONS` requests — which match no route — are answered with `204` instead of `404`.
- **Body limit**: request bodies over `BODY_LIMIT` (default 100kb) are rejected with `413` and the standard envelope, message `Request body too large`.
- **`TRUST_PROXY = true`** opts into trusting `X-Forwarded-For` (via `Config\App::$trustProxy`) so rate limits key on the real client IP behind a proxy. Leave it `false` unless a proxy you control sets that header.

### Configuration

All knobs live in `.env` (defaults in `.env.example`) and `Config\RateLimit`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | `3` / `900000` | Failures per email, sliding window |
| `LOGIN_IP_RATE_LIMIT_MAX` / `LOGIN_IP_RATE_LIMIT_WINDOW_MS` | `10` / `900000` | Failures per IP, sliding window |
| `RATE_LIMIT_ENABLED` | `true` | Global limiter switch (forced off when `ENVIRONMENT = testing`) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `300` / `60000` | Global requests per IP, sliding window |
| `BODY_LIMIT` | `102400` | Max request body in bytes |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated CORS allowlist |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` for client IPs |
| `ENABLE_HSTS` | `false` | Send `Strict-Transport-Security` over HTTPS |

**Scaling caveat**: counters live in the configured cache handler (files under `writable/cache` by default). That is shared by every worker on one machine, but not across machines: behind several servers each host counts separately. Point `Config\Cache` at Redis (or another shared handler) and the same code shares the counters everywhere — no change to `RateLimiter` needed.

---

# CodeIgniter 4 Application Starter

## What is CodeIgniter?

CodeIgniter is a PHP full-stack web framework that is light, fast, flexible and secure.
More information can be found at the [official site](https://codeigniter.com).

This repository holds a composer-installable app starter.
It has been built from the
[development repository](https://github.com/codeigniter4/CodeIgniter4).

More information about the plans for version 4 can be found in [CodeIgniter 4](https://forum.codeigniter.com/forumdisplay.php?fid=28) on the forums.

You can read the [user guide](https://codeigniter.com/user_guide/)
corresponding to the latest version of the framework.

## Installation & updates

`composer create-project codeigniter4/appstarter` then `composer update` whenever
there is a new release of the framework.

When updating, check the release notes to see if there are any changes you might need to apply
to your `app` folder. The affected files can be copied or merged from
`vendor/codeigniter4/framework/app`.

## Setup

Copy `env` to `.env` and tailor for your app, specifically the baseURL
and any database settings.

## Important Change with index.php

`index.php` is no longer in the root of the project! It has been moved inside the *public* folder,
for better security and separation of components.

This means that you should configure your web server to "point" to your project's *public* folder, and
not to the project root. A better practice would be to configure a virtual host to point there. A poor practice would be to point your web server to the project root and expect to enter *public/...*, as the rest of your logic and the
framework are exposed.

**Please** read the user guide for a better explanation of how CI4 works!

## Repository Management

We use GitHub issues, in our main repository, to track **BUGS** and to track approved **DEVELOPMENT** work packages.
We use our [forum](http://forum.codeigniter.com) to provide SUPPORT and to discuss
FEATURE REQUESTS.

This repository is a "distribution" one, built by our release preparation script.
Problems with it can be raised on our forum, or as issues in the main repository.

## Server Requirements

PHP version 8.2 or higher is required, with the following extensions installed:

- [intl](http://php.net/manual/en/intl.requirements.php)
- [mbstring](http://php.net/manual/en/mbstring.installation.php)

> [!WARNING]
> - The end of life date for PHP 7.4 was November 28, 2022.
> - The end of life date for PHP 8.0 was November 26, 2023.
> - The end of life date for PHP 8.1 was December 31, 2025.
> - If you are still using below PHP 8.2, you should upgrade immediately.
> - The end of life date for PHP 8.2 will be December 31, 2026.

Additionally, make sure that the following extensions are enabled in your PHP:

- json (enabled by default - don't turn it off)
- [mysqlnd](http://php.net/manual/en/mysqlnd.install.php) if you plan to use MySQL
- [libcurl](http://php.net/manual/en/curl.requirements.php) if you plan to use the HTTP\CURLRequest library
