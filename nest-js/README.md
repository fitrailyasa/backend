# Backend Starter — NestJS (JavaScript) + TypeORM + MySQL

A production-ready REST API starter template built with **Node.js >= 20**, **NestJS 11** using modern JavaScript (ES2022 + Babel/SWC decorators), **TypeORM 0.3**, and **MySQL 8** (with SQLite fallback for local development and testing), implementing the shared API contract in `_SPEC.md`.

Includes full domain support for authentication, users, categories, products, tags, orders, comments, Swagger OpenAPI docs, rate limiting, and an automated test suite.

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
- **Base API**: `http://localhost:3002/api/v1`
- **Health Check**: `http://localhost:3002/health`
- **Swagger Documentation**: `http://localhost:3002/api/docs`

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
| `PORT` | `3002` | Port HTTP server listens on |
| `API_PREFIX` | `api/v1` | Global API prefix (excluding `/health`) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated or `*`) |
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

---

## Available scripts

- `npm start` - Start production server with Nest CLI
- `npm run start:dev` - Start development server with file watch
- `npm run build` - Compile project to `dist/`
- `npm run seed` - Seed demo data
- `npm test` - Run test suite with Jest

---

## Database & Migrations

The database schema and demo seeder can be run using SQL files or TypeORM:

- Schema file: [database/schema.sql](file:///c:/Users/ASUS/Documents/GitHub/backend/nest-js/database/schema.sql)
- Seed file: [database/seed.sql](file:///c:/Users/ASUS/Documents/GitHub/backend/nest-js/database/seed.sql)

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
