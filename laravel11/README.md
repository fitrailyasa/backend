## Backend Starter API

This Laravel 11 project implements the shared contract in [`../_SPEC.md`](../_SPEC.md). Requirements: PHP 8.2+, Composer, MySQL 8 or MariaDB 10.6+, and PHP extensions `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, and `ctype`.

### Setup

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
```

Create the `backend_starter` database with `utf8mb4_unicode_ci`, set its credentials in `.env`, then run:

```sh
php artisan migrate --seed
php artisan serve
```

API base: `http://127.0.0.1:8000/api/v1`. Demo admin: `admin@example.com` / `password`; all demo users use password `password`. Replace `JWT_SECRET` with a unique random secret of at least 32 characters before deployment. Access and refresh tokens expire in 3600 and 604800 seconds by default; the file cache stores revoked token IDs.

### Endpoint coverage

- Auth: register, login, refresh, logout, current user
- Users: admin CRUD; current profile at `/users/me`
- Categories, products, tags: public reads and admin CRUD
- Orders: authenticated owner/admin reads and create, status transition, admin delete
- Comments: public product comments; authenticated create; owner/admin update and delete
- Health: `/health`; API route index: `/api/v1`

Collection endpoints support `page`, `limit` (max 100), `search`, `sort`, and `order`; products support category/tag/price filters and resources support the documented `include` relations. All responses use the shared envelope and omit password fields.

Run tests with `php artisan test`. `php artisan migrate:fresh --seed` is destructive and resets the configured database.

## Security

Implements [`../_SECURITY_SPEC.md`](../_SECURITY_SPEC.md):

- **Login attempt limiter** — `POST /api/v1/auth/login` allows **3 failed credential checks per normalized email per 15 minutes** (`LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS`) and **10 per client IP per 15 minutes** (`LOGIN_IP_RATE_LIMIT_MAX` / `LOGIN_IP_RATE_LIMIT_WINDOW_MS`). Windows are sliding; both "unknown email" and "wrong password" count; a successful login clears that email's counter. The lock is checked **before** any password hashing. While locked, even a correct password returns **429** with a `Retry-After` header and the standard error envelope (no `errors` key). Unknown emails still verify the password against a fixed dummy hash so response timing does not reveal account existence, and both failure modes return the same generic 401 message.
- **Global request rate limit** — 300 requests / 60 seconds per IP (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_ENABLED`) on every route except `/health`, `/up`, `/api/v1`, and `/api/v1/health`. Over-limit requests get 429 + `Retry-After`. Automatically skipped when `APP_ENV=testing`.
- **Security headers** on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. The JSON API gets `Content-Security-Policy: default-src 'none'`; the Swagger UI page (`/api/v1/docs`) and the welcome page get `default-src 'self'` plus the minimal inline style/script allowances they need. `Strict-Transport-Security` is only emitted for HTTPS requests and only when `ENABLE_HSTS=true` (default off).
- **Fingerprint removal** — `X-Powered-By` and similar framework headers are stripped from every response.
- **CORS allowlist** — origins come from `CORS_ORIGINS` (comma separated), default `http://localhost:3000,http://localhost:5173,http://localhost:4200`. Only listed origins are reflected, credentials are never combined with a wildcard, `Vary: Origin` is set, and preflight results are cached for at most 600 s.
- **Body size cap** — request bodies over 100 KB (`BODY_LIMIT`, bytes) are rejected with 413 using the standard envelope.
- **Proxy trust** — `TRUST_PROXY` (default `false`) controls whether `X-Forwarded-For` is trusted; leave it off unless behind a reverse proxy, since a wrong default either makes IP limits spoofable or lumps all clients behind one IP.
- **500s** are sanitized (`Internal server error`); details stay in the server log. Passwords and tokens are never logged.

**Caveat:** the login and global rate-limit counters are kept **in process memory** (pruned, but per process). This is exact for `php artisan serve`/one FPM worker; scale vertically or swap the store for Redis when running multiple instances or workers.

New env vars (see `.env.example`): `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_IP_RATE_LIMIT_MAX`, `LOGIN_IP_RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `BODY_LIMIT`, `ENABLE_HSTS`, `TRUST_PROXY`, `CORS_ORIGINS`. They are surfaced through `config/security.php` and `config/cors.php`.

---

<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

You may also try the [Laravel Bootcamp](https://bootcamp.laravel.com), where you will be guided through building a modern Laravel application from scratch.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com/)**
- **[Tighten Co.](https://tighten.co)**
- **[WebReinvent](https://webreinvent.com/)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel/)**
- **[Cyber-Duck](https://cyber-duck.co.uk)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Jump24](https://jump24.co.uk)**
- **[Redberry](https://redberry.international/laravel/)**
- **[Active Logic](https://activelogic.com)**
- **[byte5](https://byte5.de)**
- **[OP.GG](https://op.gg)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
