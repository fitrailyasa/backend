# Go (Gin)

REST API for the shared starter contract. Gin is the HTTP framework. Persistence uses GORM against the shared MySQL database `backend_starter`, and tests use an in-memory SQLite database.

Product writes accept `tags` (this service's field) and `tag_ids` (the field used by Nest, Laravel, CodeIgniter, and Rails).

## Prerequisites

- Go 1.23 or newer
- MySQL 8 with the `backend_starter` database (see `database/schema.sql`)

## Setup

```powershell
cd go
copy .env.example .env
go mod download
```

`DB_SYNC` stays `false` so this process does not alter tables that the other frameworks already use. Apply `database/schema.sql` yourself only on an empty database.

## Seed

```powershell
go run ./cmd/server seed
```

The seeder inserts the demo catalog only when `admin@example.com` is missing. It does not delete or rewrite existing rows.

Demo login: `admin@example.com` / `password`. Other accounts are `user@example.com` through `user5@example.com`, same password.

## Run

```powershell
go run ./cmd/server
```

- API: http://localhost:8090/api/v1
- Health: http://localhost:8090/health
- Swagger UI: http://localhost:8090/api/v1/docs
- OpenAPI: http://localhost:8090/api/v1/docs.json

`api.http` exercises the same endpoints.

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/v1` | public |
| GET | `/api/v1/docs` | public |
| GET | `/api/v1/docs.json` | public |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public |
| POST | `/api/v1/auth/logout` | bearer |
| GET | `/api/v1/auth/me` | bearer |
| GET, POST | `/api/v1/users` | admin |
| GET, PATCH | `/api/v1/users/me` | bearer |
| GET, PUT, PATCH, DELETE | `/api/v1/users/{id}` | admin |
| GET | `/api/v1/categories`, `/api/v1/categories/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/categories/{id}` | admin |
| GET | `/api/v1/products`, `/api/v1/products/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/products/{id}` | admin |
| GET | `/api/v1/tags`, `/api/v1/tags/{id}` | public |
| POST, PUT, PATCH, DELETE | `/api/v1/tags/{id}` | admin |
| GET, POST | `/api/v1/orders` | bearer |
| GET | `/api/v1/orders/{id}` | owner or admin |
| PATCH | `/api/v1/orders/{id}/status` | admin, or owner cancelling a pending order |
| DELETE | `/api/v1/orders/{id}` | admin |
| GET | `/api/v1/products/{id}/comments` | public |
| POST | `/api/v1/products/{id}/comments` | bearer |
| GET | `/api/v1/comments` | public |
| PATCH, DELETE | `/api/v1/comments/{id}` | owner or admin |

Collection queries: `page`, `limit` (max 100), `search`, `sort`, `order`. Products also accept `category_id`, `tag_id`, `tag`, `min_price`, `max_price`. Optional `include` values are `category` and `tags` on products, `products` on categories, and `items`, `items.product`, `user` on orders.

## Test

```powershell
go test ./...
```
