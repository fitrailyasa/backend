<?php

namespace App\Controllers;

use App\Libraries\ApiJson;
use App\Libraries\JwtToken;
use Config\Database;

class Api extends BaseController
{
    private const RESOURCES = [
        'users' => ['table' => 'users', 'fields' => ['name', 'email', 'role'], 'search' => ['name', 'email']],
        'categories' => ['table' => 'categories', 'fields' => ['name', 'slug', 'description'], 'search' => ['name', 'description']],
        'products' => ['table' => 'products', 'fields' => ['category_id', 'name', 'slug', 'description', 'price', 'stock'], 'search' => ['name', 'description']],
        'tags' => ['table' => 'tags', 'fields' => ['name', 'slug'], 'search' => ['name']],
        'orders' => ['table' => 'orders', 'fields' => [], 'search' => []],
    ];

    public function apiIndex()
    {
        $base = rtrim((string) config('App')->baseURL, '/');
        return $this->response->setJSON([
            'success' => true,
            'message' => 'API index retrieved',
            'data' => ApiJson::index('backend-starter-ci4', $base),
        ]);
    }

    public function health()
    {
        $start = (float) ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true));
        return $this->response->setJSON([
            'status' => 'ok',
            'uptime' => microtime(true) - $start,
            'timestamp' => gmdate('Y-m-d\TH:i:s.v\Z'),
        ]);
    }

    public function index(string $resource = '')
    {
        if (!isset(self::RESOURCES[$resource])) return $this->fail(404, 'Resource not found');
        $request = $this->request;
        $db = Database::connect();
        $table = self::RESOURCES[$resource]['table'];
        $builder = $db->table($table);
        if ($resource === 'users') $builder->select('id, name, email, role, created_at, updated_at');
        if ($resource === 'orders') {
            $user = $this->currentUser();
            if ($user->role !== 'admin') $builder->where('user_id', $user->id);
            elseif ($request->getGet('user_id')) $builder->where('user_id', $request->getGet('user_id'));
            if ($request->getGet('status')) $builder->where('status', $request->getGet('status'));
        }
        if ($resource === 'products') {
            foreach (['category_id' => '='] as $field => $operator) if ($request->getGet($field) !== null) $builder->where($field, $request->getGet($field));
            if ($request->getGet('min_price') !== null) $builder->where('price >=', $request->getGet('min_price'));
            if ($request->getGet('max_price') !== null) $builder->where('price <=', $request->getGet('max_price'));
            if ($request->getGet('tag_id') || $request->getGet('tag')) {
                $tags = $db->table('product_tag')->select('product_id')->join('tags', 'tags.id = product_tag.tag_id');
                if ($request->getGet('tag_id')) $tags->where('tag_id', $request->getGet('tag_id'));
                else $tags->where('tags.slug', $request->getGet('tag'));
                $ids = array_column($tags->get()->getResultArray(), 'product_id');
                $builder->whereIn('id', $ids ?: [0]);
            }
        }
        if ($request->getGet('search') !== null && self::RESOURCES[$resource]['search']) {
            $builder->groupStart();
            foreach (self::RESOURCES[$resource]['search'] as $index => $field) {
                if ($index === 0) $builder->like($field, $request->getGet('search'));
                else $builder->orLike($field, $request->getGet('search'));
            }
            $builder->groupEnd();
        }

        $page = max(1, (int) ($request->getGet('page') ?? 1));
        $limit = min(100, max(1, (int) ($request->getGet('limit') ?? 10)));
        $total = $builder->countAllResults(false);
        $sortable = array_merge(['id', 'created_at', 'updated_at'], self::RESOURCES[$resource]['fields']);
        $sort = in_array($request->getGet('sort') ?? 'id', $sortable, true) ? ($request->getGet('sort') ?? 'id') : 'id';
        $order = strtolower((string) ($request->getGet('order') ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
        $rows = $builder->orderBy($sort, $order)->limit($limit, ($page - 1) * $limit)->get()->getResultArray();
        $data = array_map(fn(array $row) => $this->enrich($resource, $row), $rows);
        return $this->response->setJSON(['success' => true, 'message' => ucfirst($resource) . ' retrieved', 'data' => $data, 'meta' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => (int) ceil($total / $limit),
        ]]);
    }

    public function show(string $resource, int $id)
    {
        if (!isset(self::RESOURCES[$resource])) return $this->fail(404, 'Resource not found');
        $row = Database::connect()->table(self::RESOURCES[$resource]['table'])->where('id', $id)->get()->getRowArray();
        if (!$row) return $this->fail(404, $this->singular($resource) . ' not found');
        if ($resource === 'orders' && !$this->ownsOrAdmin((int) $row['user_id'])) return $this->fail(403, 'This action is unauthorized');
        return $this->respond($this->singular($resource) . ' retrieved', $this->enrich($resource, $row));
    }

    public function create(string $resource)
    {
        if (!isset(self::RESOURCES[$resource])) return $this->fail(404, 'Resource not found');
        if ($resource === 'orders') return $this->createOrder();
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validateResource($resource, $data, true);
        if ($errors) return $this->invalid($errors);
        $fields = self::RESOURCES[$resource]['fields'];
        $values = array_intersect_key($data, array_flip($fields));
        if (in_array($resource, ['categories', 'products', 'tags'], true) && empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if ($resource === 'users') $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        $conflict = $this->uniqueConflict($resource, $values);
        if ($conflict) return $this->fail(409, $conflict . ' already exists');
        $values['created_at'] = date('Y-m-d H:i:s');
        $values['updated_at'] = $values['created_at'];
        $db = Database::connect();
        try {
            $db->table(self::RESOURCES[$resource]['table'])->insert($values);
            $id = (int) $db->insertID();
            if ($resource === 'products') $this->syncTags($id, $data['tag_ids'] ?? []);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        $row = $db->table(self::RESOURCES[$resource]['table'])->where('id', $id)->get()->getRowArray();
        return $this->response->setStatusCode(201)->setJSON(['success' => true, 'message' => $this->singular($resource) . ' created successfully', 'data' => $this->enrich($resource, $row)]);
    }

    public function update(string $resource, int $id)
    {
        if (!isset(self::RESOURCES[$resource]) || $resource === 'orders') return $this->fail(404, 'Resource not found');
        $db = Database::connect();
        $table = self::RESOURCES[$resource]['table'];
        $row = $db->table($table)->where('id', $id)->get()->getRowArray();
        if (!$row) return $this->fail(404, $this->singular($resource) . ' not found');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validateResource($resource, $data, false);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(self::RESOURCES[$resource]['fields']));
        if ($resource === 'users' && !empty($data['password'])) $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        if (in_array($resource, ['categories', 'products', 'tags'], true) && isset($values['name']) && empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        $conflict = $this->uniqueConflict($resource, $values, $id);
        if ($conflict) return $this->fail(409, $conflict . ' already exists');
        $values['updated_at'] = date('Y-m-d H:i:s');
        try {
            $db->table($table)->where('id', $id)->update($values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        if ($resource === 'products' && array_key_exists('tag_ids', $data)) $this->syncTags($id, $data['tag_ids']);
        return $this->respond($this->singular($resource) . ' updated successfully', $this->enrich($resource, $db->table($table)->where('id', $id)->get()->getRowArray()));
    }

    public function delete(string $resource, int $id)
    {
        if (!isset(self::RESOURCES[$resource])) return $this->fail(404, 'Resource not found');
        $db = Database::connect();
        $table = self::RESOURCES[$resource]['table'];
        if (!$db->table($table)->where('id', $id)->countAllResults()) return $this->fail(404, $this->singular($resource) . ' not found');
        try {
            $db->table($table)->where('id', $id)->delete();
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond($this->singular($resource) . ' deleted successfully', null);
    }

    public function status(int $id)
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['status' => 'required|in_list[pending,paid,shipped,completed,cancelled]']);
        if ($errors) return $this->invalid($errors);
        $db = Database::connect();
        $order = $db->table('orders')->where('id', $id)->get()->getRowArray();
        if (!$order) return $this->fail(404, 'Order not found');
        $user = $this->currentUser();
        if ($user->role !== 'admin' && ((int) $order['user_id'] !== (int) $user->id || $order['status'] !== 'pending' || $data['status'] !== 'cancelled')) return $this->fail(403, 'This action is unauthorized');
        $db->table('orders')->where('id', $id)->update(['status' => $data['status'], 'updated_at' => date('Y-m-d H:i:s')]);
        return $this->respond('Order status updated successfully', $this->enrich('orders', $db->table('orders')->where('id', $id)->get()->getRowArray()));
    }

    public function commentIndex()
    {
        return $this->commentList(null);
    }

    public function comments(int $productId)
    {
        if (!Database::connect()->table('products')->where('id', $productId)->countAllResults()) return $this->fail(404, 'Product not found');
        return $this->commentList($productId);
    }

    private function commentList(?int $productId)
    {
        $request = $this->request;
        $builder = Database::connect()->table('comments');
        if ($productId !== null) $builder->where('product_id', $productId);
        elseif ($request->getGet('product_id') !== null) $builder->where('product_id', $request->getGet('product_id'));
        if ($request->getGet('user_id') !== null) $builder->where('user_id', $request->getGet('user_id'));
        if ($request->getGet('search') !== null) $builder->like('body', $request->getGet('search'));
        $page = max(1, (int) ($request->getGet('page') ?? 1));
        $limit = min(100, max(1, (int) ($request->getGet('limit') ?? 10)));
        $total = $builder->countAllResults(false);
        $sortable = ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at'];
        $sort = in_array($request->getGet('sort') ?? 'id', $sortable, true) ? ($request->getGet('sort') ?? 'id') : 'id';
        $order = strtolower((string) ($request->getGet('order') ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
        $rows = $builder->orderBy($sort, $order)->limit($limit, ($page - 1) * $limit)->get()->getResultArray();
        return $this->response->setJSON(['success' => true, 'message' => 'Comments retrieved', 'data' => array_map(fn($row) => $this->enrich('comments', $row), $rows), 'meta' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'total_pages' => (int) ceil($total / $limit)]]);
    }

    public function commentCreate(int $productId)
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['body' => 'required|string']);
        if ($errors) return $this->invalid($errors);
        $db = Database::connect();
        if (!$db->table('products')->where('id', $productId)->countAllResults()) return $this->fail(404, 'Product not found');
        $now = date('Y-m-d H:i:s');
        $db->table('comments')->insert(['product_id' => $productId, 'user_id' => $this->currentUser()->id, 'body' => $data['body'], 'created_at' => $now, 'updated_at' => $now]);
        $row = $db->table('comments')->where('id', $db->insertID())->get()->getRowArray();
        return $this->response->setStatusCode(201)->setJSON(['success' => true, 'message' => 'Comment created successfully', 'data' => $this->enrich('comments', $row)]);
    }

    public function commentUpdate(int $id)
    {
        $db = Database::connect();
        $comment = $db->table('comments')->where('id', $id)->get()->getRowArray();
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin((int) $comment['user_id'])) return $this->fail(403, 'This action is unauthorized');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['body' => 'required|string']);
        if ($errors) return $this->invalid($errors);
        $db->table('comments')->where('id', $id)->update(['body' => $data['body'], 'updated_at' => date('Y-m-d H:i:s')]);
        return $this->respond('Comment updated successfully', $this->enrich('comments', $db->table('comments')->where('id', $id)->get()->getRowArray()));
    }

    public function commentDelete(int $id)
    {
        $db = Database::connect();
        $comment = $db->table('comments')->where('id', $id)->get()->getRowArray();
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin((int) $comment['user_id'])) return $this->fail(403, 'This action is unauthorized');
        $db->table('comments')->where('id', $id)->delete();
        return $this->respond('Comment deleted successfully', null);
    }

    private function createOrder()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['items' => 'required']);
        if (!$errors && (!is_array($data['items']) || count($data['items']) === 0)) $errors['items'] = ['The items field must contain at least one item.'];
        if (!$errors) {
            foreach ($data['items'] as $index => $item) {
                if (!is_array($item) || filter_var($item['product_id'] ?? null, FILTER_VALIDATE_INT) === false || (int) $item['product_id'] < 1) {
                    $errors['items.' . $index . '.product_id'] = ['A valid product_id is required.'];
                }
                if (!is_array($item) || filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT) === false || (int) $item['quantity'] < 1) {
                    $errors['items.' . $index . '.quantity'] = ['Quantity must be an integer greater than zero.'];
                }
            }
        }
        if ($errors) return $this->invalid($errors);

        $db = Database::connect();
        $db->transBegin();
        try {
            $now = date('Y-m-d H:i:s');
            $db->table('orders')->insert(['user_id' => $this->currentUser()->id, 'status' => 'pending', 'total' => 0, 'created_at' => $now, 'updated_at' => $now]);
            $orderId = (int) $db->insertID();
            $totalCents = 0;
            foreach ($data['items'] as $item) {
                $product = $db->table('products')->where('id', $item['product_id'])->get()->getRowArray();
                if (!$product) {
                    $db->transRollback();
                    return $this->invalid(['items' => ['A selected product does not exist.']]);
                }
                $priceCents = (int) round((float) $product['price'] * 100);
                $totalCents += $priceCents * (int) $item['quantity'];
                $db->table('order_items')->insert(['order_id' => $orderId, 'product_id' => $product['id'], 'quantity' => $item['quantity'], 'price' => $product['price'], 'created_at' => $now, 'updated_at' => $now]);
            }
            $db->table('orders')->where('id', $orderId)->update(['total' => number_format($totalCents / 100, 2, '.', '')]);
            if (!$db->transStatus()) throw new \RuntimeException('Order transaction failed.');
            $db->transCommit();
        } catch (\Throwable $exception) {
            $db->transRollback();
            throw $exception;
        }
        return $this->response->setStatusCode(201)->setJSON(['success' => true, 'message' => 'Order created successfully', 'data' => $this->enrich('orders', $db->table('orders')->where('id', $orderId)->get()->getRowArray())]);
    }

    private function validateResource(string $resource, array $data, bool $creating): array
    {
        $required = $creating ? 'required|' : 'permit_empty|';
        $rules = match ($resource) {
            'users' => ['name' => $required . 'string|max_length[100]', 'email' => $required . 'valid_email|max_length[150]', 'role' => 'permit_empty|in_list[user,admin]', 'password' => ($creating ? 'required|' : 'permit_empty|') . 'string|min_length[8]'],
            'categories' => ['name' => $required . 'string|max_length[100]', 'slug' => 'permit_empty|string|max_length[120]', 'description' => 'permit_empty|string'],
            'products' => ['category_id' => $required . 'is_natural_no_zero', 'name' => $required . 'string|max_length[150]', 'slug' => 'permit_empty|string|max_length[180]', 'description' => 'permit_empty|string', 'price' => $required . 'decimal|greater_than_equal_to[0]', 'stock' => 'permit_empty|integer|greater_than_equal_to[0]', 'tag_ids' => 'permit_empty'],
            'tags' => ['name' => $required . 'string|max_length[60]', 'slug' => 'permit_empty|string|max_length[80]'],
            default => [],
        };
        $errors = $this->validatePayload($data, $rules);
        if ($resource === 'products' && isset($data['category_id']) && !Database::connect()->table('categories')->where('id', $data['category_id'])->countAllResults()) $errors['category_id'] = ['The selected category_id is invalid.'];
        if ($resource === 'products' && isset($data['tag_ids'])) {
            if (!is_array($data['tag_ids'])) $errors['tag_ids'] = ['The tag_ids field must be an array.'];
            else foreach ($data['tag_ids'] as $tagId) if (!Database::connect()->table('tags')->where('id', $tagId)->countAllResults()) {
                $errors['tag_ids'] = ['The selected tag_ids field is invalid.'];
                break;
            }
        }
        return $errors;
    }

    private function validatePayload(array $data, array $rules): array
    {
        if (!$rules) return [];
        $validation = service('validation');
        if ($validation->setRules($rules)->run($data)) return [];
        $errors = [];
        foreach ($validation->getErrors() as $field => $message) $errors[$field] = [(string) $message];
        return $errors;
    }

    private function input(): array
    {
        $raw = $this->request->getBody();
        if ($raw !== '' && json_decode($raw) === null && json_last_error() !== JSON_ERROR_NONE) return ['_malformed_json' => true];
        return $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
    }

    private function enrich(string $resource, array $row): array
    {
        unset($row['password'], $row['remember_token'], $row['email_verified_at']);
        $includes = array_filter(explode(',', (string) $this->request->getGet('include')));
        $db = Database::connect();
        if ($resource === 'products') {
            if (in_array('category', $includes, true)) $row['category'] = $db->table('categories')->where('id', $row['category_id'])->get()->getRowArray();
            if (in_array('tags', $includes, true)) $row['tags'] = $db->table('tags')->select('tags.id, tags.name, tags.slug, tags.created_at, tags.updated_at')->join('product_tag', 'tags.id = product_tag.tag_id')->where('product_tag.product_id', $row['id'])->get()->getResultArray();
        }
        if ($resource === 'categories' && in_array('products', $includes, true)) $row['products'] = $db->table('products')->where('category_id', $row['id'])->get()->getResultArray();
        if ($resource === 'orders') {
            if (in_array('user', $includes, true)) $row['user'] = $this->publicUser($db->table('users')->where('id', $row['user_id'])->get()->getRowArray());
            if (in_array('items', $includes, true) || in_array('items.product', $includes, true)) {
                $row['items'] = $db->table('order_items')->where('order_id', $row['id'])->get()->getResultArray();
                if (in_array('items.product', $includes, true)) foreach ($row['items'] as &$item) $item['product'] = $db->table('products')->where('id', $item['product_id'])->get()->getRowArray();
            }
        }
        if ($resource === 'comments' && in_array('user', $includes, true)) $row['user'] = $this->publicUser($db->table('users')->where('id', $row['user_id'])->get()->getRowArray());
        return $row;
    }

    private function publicUser(?array $user): ?array
    {
        if (!$user) return null;
        return array_intersect_key($user, array_flip(['id', 'name', 'email', 'role', 'created_at', 'updated_at']));
    }

    private function syncTags(int $productId, array $tagIds): void
    {
        $db = Database::connect();
        $db->table('product_tag')->where('product_id', $productId)->delete();
        foreach (array_unique($tagIds) as $tagId) $db->table('product_tag')->ignore(true)->insert(['product_id' => $productId, 'tag_id' => $tagId]);
    }

    private function uniqueConflict(string $resource, array $values, ?int $id = null): ?string
    {
        $unique = match ($resource) {
            'users' => ['email'],
            'categories' => ['slug'],
            'products' => ['slug'],
            'tags' => ['slug'],
            default => []
        };
        foreach ($unique as $field) {
            if (!isset($values[$field])) continue;
            $query = Database::connect()->table(self::RESOURCES[$resource]['table'])->where($field, $values[$field]);
            if ($id !== null) $query->where('id !=', $id);
            if ($query->countAllResults() > 0) return ucfirst($field);
        }
        return null;
    }

    private function singular(string $resource): string
    {
        return ucfirst(match ($resource) {
            'users' => 'user',
            'categories' => 'category',
            'products' => 'product',
            'tags' => 'tag',
            'orders' => 'order',
            'comments' => 'comment',
            default => $resource,
        });
    }

    private function slug(string $value): string
    {
        return trim(preg_replace('/-+/', '-', strtolower(preg_replace('/[^a-z0-9]+/i', '-', trim($value)))), '-');
    }
    private function currentUser(): object
    {
        $header = $this->request->getHeaderLine('Authorization');
        preg_match('/^Bearer\s+(.+)$/i', $header, $matches);
        $claims = isset($matches[1]) ? JwtToken::decode($matches[1]) : null;
        return Database::connect()->table('users')->where('id', $claims['sub'] ?? 0)->get()->getRow() ?? (object) ['id' => 0, 'role' => 'user'];
    }

    private function ownsOrAdmin(int $owner): bool
    {
        $user = $this->currentUser();
        return $user->role === 'admin' || (int) $user->id === $owner;
    }
    private function isConflict(\Throwable $exception): bool
    {
        $message = strtolower($exception->getMessage());
        return str_contains($message, 'duplicate') || str_contains($message, 'unique');
    }
    private function respond(string $message, mixed $data)
    {
        return $this->response->setJSON(['success' => true, 'message' => $message, 'data' => $data]);
    }
    private function fail(int $status, string $message)
    {
        return $this->response->setStatusCode($status)->setJSON(['success' => false, 'message' => $message]);
    }
    private function invalid(array $errors)
    {
        return $this->response->setStatusCode(422)->setJSON(['success' => false, 'message' => 'Validation failed', 'errors' => $errors]);
    }
}
