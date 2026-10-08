<?php

namespace App\Support;

class ApiJson
{
    public static function normalize(mixed $value, ?string $key = null): mixed
    {
        if (is_array($value)) {
            $list = array_is_list($value);
            $out = [];
            foreach ($value as $childKey => $child) {
                $out[$childKey] = self::normalize($child, $list ? null : (string) $childKey);
            }
            return $out;
        }

        if (!is_string($value) || $key === null) {
            return $value;
        }

        if (self::isNumericKey($key) && preg_match('/^-?\d+(\.\d+)?$/', $value) === 1) {
            return str_contains($value, '.') ? (float) $value : (int) $value;
        }

        if (in_array($key, ['created_at', 'updated_at'], true) && preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/', $value) === 1) {
            $value = str_replace(' ', 'T', $value);
            if (!str_contains($value, '.')) {
                $value .= '.000';
            } else {
                [$head, $fraction] = explode('.', $value, 2);
                $value = $head . '.' . substr(str_pad($fraction, 3, '0'), 0, 3);
            }
            return $value . 'Z';
        }

        return $value;
    }

    public static function index(string $name, string $baseUrl): array
    {
        return [
            'name' => $name,
            'version' => '1.0.0',
            'prefix' => '/api/v1',
            'documentation' => '/api/v1/docs',
            'endpoints' => self::endpoints(),
            'base_url' => $baseUrl,
        ];
    }

    private static function isNumericKey(string $key): bool
    {
        return $key === 'id' || str_ends_with($key, '_id') || in_array($key, ['price', 'total', 'stock', 'quantity', 'page', 'limit', 'total_pages'], true);
    }

    private static function endpoints(): array
    {
        return [
            ['method' => 'GET', 'path' => '/health', 'auth' => 'public', 'description' => 'Liveness probe'],
            ['method' => 'GET', 'path' => '/api/v1', 'auth' => 'public', 'description' => 'API index'],
            ['method' => 'POST', 'path' => '/api/v1/auth/register', 'auth' => 'public', 'description' => 'Register, returns token + user'],
            ['method' => 'POST', 'path' => '/api/v1/auth/login', 'auth' => 'public', 'description' => 'Login, returns token + user'],
            ['method' => 'POST', 'path' => '/api/v1/auth/refresh', 'auth' => 'bearer', 'description' => 'Issue a new token pair'],
            ['method' => 'POST', 'path' => '/api/v1/auth/logout', 'auth' => 'bearer', 'description' => 'Revoke the current token'],
            ['method' => 'GET', 'path' => '/api/v1/auth/me', 'auth' => 'bearer', 'description' => 'Current user'],
            ['method' => 'GET', 'path' => '/api/v1/users', 'auth' => 'admin', 'description' => 'List users'],
            ['method' => 'POST', 'path' => '/api/v1/users', 'auth' => 'admin', 'description' => 'Create a user'],
            ['method' => 'GET', 'path' => '/api/v1/users/me', 'auth' => 'bearer', 'description' => 'Current user profile'],
            ['method' => 'PATCH', 'path' => '/api/v1/users/me', 'auth' => 'bearer', 'description' => 'Update own profile'],
            ['method' => 'GET', 'path' => '/api/v1/users/{id}', 'auth' => 'admin', 'description' => 'Get a user'],
            ['method' => 'PUT', 'path' => '/api/v1/users/{id}', 'auth' => 'admin', 'description' => 'Replace a user'],
            ['method' => 'PATCH', 'path' => '/api/v1/users/{id}', 'auth' => 'admin', 'description' => 'Update a user'],
            ['method' => 'DELETE', 'path' => '/api/v1/users/{id}', 'auth' => 'admin', 'description' => 'Delete a user'],
            ['method' => 'GET', 'path' => '/api/v1/categories', 'auth' => 'public', 'description' => 'List categories'],
            ['method' => 'GET', 'path' => '/api/v1/categories/{id}', 'auth' => 'public', 'description' => 'Get a category'],
            ['method' => 'POST', 'path' => '/api/v1/categories', 'auth' => 'admin', 'description' => 'Create a category'],
            ['method' => 'PUT', 'path' => '/api/v1/categories/{id}', 'auth' => 'admin', 'description' => 'Replace a category'],
            ['method' => 'PATCH', 'path' => '/api/v1/categories/{id}', 'auth' => 'admin', 'description' => 'Update a category'],
            ['method' => 'DELETE', 'path' => '/api/v1/categories/{id}', 'auth' => 'admin', 'description' => 'Delete a category'],
            ['method' => 'GET', 'path' => '/api/v1/products', 'auth' => 'public', 'description' => 'List products, filter by category_id, tag_id, tag, min_price, max_price'],
            ['method' => 'GET', 'path' => '/api/v1/products/{id}', 'auth' => 'public', 'description' => 'Get a product'],
            ['method' => 'POST', 'path' => '/api/v1/products', 'auth' => 'admin', 'description' => 'Create a product'],
            ['method' => 'PUT', 'path' => '/api/v1/products/{id}', 'auth' => 'admin', 'description' => 'Replace a product'],
            ['method' => 'PATCH', 'path' => '/api/v1/products/{id}', 'auth' => 'admin', 'description' => 'Update a product'],
            ['method' => 'DELETE', 'path' => '/api/v1/products/{id}', 'auth' => 'admin', 'description' => 'Delete a product'],
            ['method' => 'GET', 'path' => '/api/v1/tags', 'auth' => 'public', 'description' => 'List tags'],
            ['method' => 'GET', 'path' => '/api/v1/tags/{id}', 'auth' => 'public', 'description' => 'Get a tag'],
            ['method' => 'POST', 'path' => '/api/v1/tags', 'auth' => 'admin', 'description' => 'Create a tag'],
            ['method' => 'PUT', 'path' => '/api/v1/tags/{id}', 'auth' => 'admin', 'description' => 'Replace a tag'],
            ['method' => 'PATCH', 'path' => '/api/v1/tags/{id}', 'auth' => 'admin', 'description' => 'Update a tag'],
            ['method' => 'DELETE', 'path' => '/api/v1/tags/{id}', 'auth' => 'admin', 'description' => 'Delete a tag'],
            ['method' => 'GET', 'path' => '/api/v1/orders', 'auth' => 'bearer', 'description' => 'List orders, filter by status (and user_id for admins)'],
            ['method' => 'POST', 'path' => '/api/v1/orders', 'auth' => 'bearer', 'description' => 'Create an order from items'],
            ['method' => 'GET', 'path' => '/api/v1/orders/{id}', 'auth' => 'bearer', 'description' => 'Get an order, owner or admin'],
            ['method' => 'PATCH', 'path' => '/api/v1/orders/{id}/status', 'auth' => 'bearer', 'description' => 'Update status, admin or owner cancelling a pending order'],
            ['method' => 'DELETE', 'path' => '/api/v1/orders/{id}', 'auth' => 'admin', 'description' => 'Delete an order'],
            ['method' => 'GET', 'path' => '/api/v1/products/{productId}/comments', 'auth' => 'public', 'description' => 'List comments for a product'],
            ['method' => 'POST', 'path' => '/api/v1/products/{productId}/comments', 'auth' => 'bearer', 'description' => 'Create a comment'],
            ['method' => 'GET', 'path' => '/api/v1/comments', 'auth' => 'public', 'description' => 'List comments, filter by product_id'],
            ['method' => 'PATCH', 'path' => '/api/v1/comments/{id}', 'auth' => 'owner or admin', 'description' => 'Update a comment'],
            ['method' => 'DELETE', 'path' => '/api/v1/comments/{id}', 'auth' => 'owner or admin', 'description' => 'Delete a comment'],
        ];
    }
}
