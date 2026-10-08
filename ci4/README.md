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
