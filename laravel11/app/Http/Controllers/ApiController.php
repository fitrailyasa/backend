<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ApiController extends Controller
{
    private const RESOURCES = [
        'users' => ['table' => 'users', 'fields' => ['name', 'email', 'role'], 'search' => ['name', 'email']],
        'categories' => ['table' => 'categories', 'fields' => ['name', 'slug', 'description'], 'search' => ['name', 'description']],
        'products' => ['table' => 'products', 'fields' => ['category_id', 'name', 'slug', 'description', 'price', 'stock'], 'search' => ['name', 'description']],
        'tags' => ['table' => 'tags', 'fields' => ['name', 'slug'], 'search' => ['name']],
        'orders' => ['table' => 'orders', 'fields' => [], 'search' => []],
    ];

    public function index(Request $request)
    {
        $resource = $this->resourceFromRequest($request);
        if ($resource === 'comments') return $this->comments($request, (string) $request->query('product_id', ''));
        $config = self::RESOURCES[$resource] ?? null;
        if (!$config) return $this->fail(404, 'Resource not found');
        $query = DB::table($config['table']);
        $user = $request->attributes->get('apiUser');
        if ($resource === 'orders' && $user->role !== 'admin') $query->where('user_id', $user->id);
        if ($resource === 'orders' && $user->role === 'admin' && $request->filled('user_id')) $query->where('user_id', $request->query('user_id'));
        if ($resource === 'orders' && $request->filled('status')) $query->where('status', $request->query('status'));
        if ($resource === 'products') {
            if ($request->filled('category_id')) $query->where('category_id', $request->query('category_id'));
            if ($request->filled('min_price')) $query->where('price', '>=', $request->query('min_price'));
            if ($request->filled('max_price')) $query->where('price', '<=', $request->query('max_price'));
            if ($request->filled('tag_id')) $query->whereExists(fn($sub) => $sub->selectRaw('1')->from('product_tag')->whereColumn('product_tag.product_id', 'products.id')->where('product_tag.tag_id', $request->query('tag_id')));
            if ($request->filled('tag')) $query->whereExists(fn($sub) => $sub->selectRaw('1')->from('product_tag')->join('tags', 'tags.id', '=', 'product_tag.tag_id')->whereColumn('product_tag.product_id', 'products.id')->where('tags.slug', $request->query('tag')));
        }
        if ($request->filled('search') && $config['search']) {
            $query->where(function ($sub) use ($config, $request): void {
                foreach ($config['search'] as $column) $sub->orWhere($column, 'like', '%' . $request->query('search') . '%');
            });
        }

        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 10)));
        $total = (clone $query)->count();
        $sortable = array_merge(['id', 'created_at', 'updated_at'], $config['fields']);
        $sort = in_array($request->query('sort', 'id'), $sortable, true) ? $request->query('sort', 'id') : 'id';
        $order = strtolower((string) $request->query('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $rows = $query->orderBy($sort, $order)->offset(($page - 1) * $limit)->limit($limit)->get();
        $data = $rows->map(fn($row) => $this->enrich($resource, $row, $request))->values();
        return response()->json(['success' => true, 'message' => $this->label($resource, true) . ' retrieved', 'data' => $data, 'meta' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => (int) ceil($total / $limit),
        ]]);
    }

    public function show(Request $request, int $id)
    {
        $resource = $this->resourceFromRequest($request);
        $row = DB::table(self::RESOURCES[$resource]['table'])->where('id', $id)->first();
        if (!$row) return $this->fail(404, $this->label($resource) . ' not found');
        if ($resource === 'orders' && !$this->ownsOrAdmin($request, $row->user_id)) return $this->fail(403, 'This action is unauthorized');
        return $this->ok($this->label($resource) . ' retrieved', $this->enrich($resource, $row, $request));
    }

    public function store(Request $request)
    {
        $resource = $this->resourceFromRequest($request);
        if ($resource === 'orders') return $this->createOrder($request);
        $validator = Validator::make($request->all(), $this->rules($resource, true));
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        $data = $request->only(self::RESOURCES[$resource]['fields']);
        if (in_array($resource, ['categories', 'products', 'tags'], true)) $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        if ($resource === 'users') $data['password'] = password_hash($request->input('password'), PASSWORD_BCRYPT);
        $data['created_at'] = now();
        $data['updated_at'] = now();
        try {
            $id = DB::table(self::RESOURCES[$resource]['table'])->insertGetId($data);
            if ($resource === 'products') $this->syncTags($id, $request->input('tag_ids', []));
        } catch (\Illuminate\Database\QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return response()->json(['success' => true, 'message' => $this->label($resource) . ' created successfully', 'data' => $this->enrich($resource, DB::table(self::RESOURCES[$resource]['table'])->where('id', $id)->first(), $request)], 201);
    }

    public function update(Request $request, int $id)
    {
        $resource = $this->resourceFromRequest($request);
        $table = self::RESOURCES[$resource]['table'];
        $row = DB::table($table)->where('id', $id)->first();
        if (!$row) return $this->fail(404, $this->label($resource) . ' not found');
        $validator = Validator::make($request->all(), $this->rules($resource, false, $id));
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        $data = $request->only(self::RESOURCES[$resource]['fields']);
        if ($resource === 'users' && $request->filled('password')) $data['password'] = password_hash($request->input('password'), PASSWORD_BCRYPT);
        if (in_array($resource, ['categories', 'products', 'tags'], true) && isset($data['name']) && empty($data['slug'])) $data['slug'] = Str::slug($data['name']);
        $data['updated_at'] = now();
        try {
            DB::table($table)->where('id', $id)->update($data);
        } catch (\Illuminate\Database\QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        if ($resource === 'products' && $request->has('tag_ids')) $this->syncTags($id, $request->input('tag_ids', []));
        return $this->ok($this->label($resource) . ' updated successfully', $this->enrich($resource, DB::table($table)->where('id', $id)->first(), $request));
    }

    public function destroy(Request $request, int $id)
    {
        $resource = $this->resourceFromRequest($request);
        $table = self::RESOURCES[$resource]['table'];
        if (!DB::table($table)->where('id', $id)->exists()) return $this->fail(404, $this->label($resource) . ' not found');
        try {
            DB::table($table)->where('id', $id)->delete();
        } catch (\Illuminate\Database\QueryException $exception) {
            if (str_contains(strtolower($exception->getMessage()), 'foreign key')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok($this->label($resource) . ' deleted successfully', null);
    }

    public function status(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), ['status' => ['required', Rule::in(['pending', 'paid', 'shipped', 'completed', 'cancelled'])]]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        $order = DB::table('orders')->where('id', $id)->first();
        if (!$order) return $this->fail(404, 'Order not found');
        $user = $request->attributes->get('apiUser');
        if ($user->role !== 'admin' && ((int) $order->user_id !== (int) $user->id || $order->status !== 'pending' || $request->input('status') !== 'cancelled')) return $this->fail(403, 'This action is unauthorized');
        DB::table('orders')->where('id', $id)->update(['status' => $request->input('status'), 'updated_at' => now()]);
        return $this->ok('Order status updated successfully', $this->enrich('orders', DB::table('orders')->where('id', $id)->first(), $request));
    }

    public function commentIndex(Request $request)
    {
        return $this->comments($request, '');
    }

    public function comments(Request $request, string $productId)
    {
        $query = DB::table('comments');
        if ($productId !== '') {
            if (!DB::table('products')->where('id', $productId)->exists()) return $this->fail(404, 'Product not found');
            $query->where('product_id', $productId);
        } elseif ($request->filled('product_id')) {
            $query->where('product_id', $request->query('product_id'));
        }
        if ($request->filled('user_id')) $query->where('user_id', $request->query('user_id'));
        if ($request->filled('search')) $query->where('body', 'like', '%' . $request->query('search') . '%');
        return $this->paginate($request, $query, 'Comments retrieved', fn($row) => $this->enrich('comments', $row, $request), ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at']);
    }

    public function commentStore(Request $request, int $productId)
    {
        $validator = Validator::make($request->all(), ['body' => ['required', 'string']]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        if (!DB::table('products')->where('id', $productId)->exists()) return $this->fail(404, 'Product not found');
        $id = DB::table('comments')->insertGetId(['product_id' => $productId, 'user_id' => $request->attributes->get('apiUser')->id, 'body' => $request->input('body'), 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(['success' => true, 'message' => 'Comment created successfully', 'data' => $this->enrich('comments', DB::table('comments')->where('id', $id)->first(), $request)], 201);
    }

    public function commentUpdate(Request $request, int $id)
    {
        $comment = DB::table('comments')->where('id', $id)->first();
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin($request, $comment->user_id)) return $this->fail(403, 'This action is unauthorized');
        $validator = Validator::make($request->all(), ['body' => ['required', 'string']]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        DB::table('comments')->where('id', $id)->update(['body' => $request->input('body'), 'updated_at' => now()]);
        return $this->ok('Comment updated successfully', $this->enrich('comments', DB::table('comments')->where('id', $id)->first(), $request));
    }

    public function commentDestroy(Request $request, int $id)
    {
        $comment = DB::table('comments')->where('id', $id)->first();
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin($request, $comment->user_id)) return $this->fail(403, 'This action is unauthorized');
        DB::table('comments')->where('id', $id)->delete();
        return $this->ok('Comment deleted successfully', null);
    }

    private function createOrder(Request $request)
    {
        $validator = Validator::make($request->all(), ['items' => ['required', 'array', 'min:1'], 'items.*.product_id' => ['required', 'integer', 'exists:products,id'], 'items.*.quantity' => ['required', 'integer', 'min:1']]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        $order = DB::transaction(function () use ($request) {
            $user = $request->attributes->get('apiUser');
            $id = DB::table('orders')->insertGetId(['user_id' => $user->id, 'status' => 'pending', 'total' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $totalCents = 0;
            foreach ($request->input('items') as $item) {
                $product = DB::table('products')->where('id', $item['product_id'])->lockForUpdate()->first();
                $totalCents += (int) round((float) $product->price * 100) * (int) $item['quantity'];
                DB::table('order_items')->insert(['order_id' => $id, 'product_id' => $product->id, 'quantity' => $item['quantity'], 'price' => $product->price, 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('orders')->where('id', $id)->update(['total' => number_format($totalCents / 100, 2, '.', '')]);
            return DB::table('orders')->where('id', $id)->first();
        });
        return response()->json(['success' => true, 'message' => 'Order created successfully', 'data' => $this->enrich('orders', $order, $request)], 201);
    }

    private function rules(string $resource, bool $creating, ?int $id = null): array
    {
        $required = $creating ? 'required' : 'sometimes';
        return match ($resource) {
            'users' => ['name' => [$required, 'string', 'max:100'], 'email' => [$required, 'email', 'max:150'], 'role' => ['sometimes', Rule::in(['user', 'admin'])], 'password' => [$creating ? 'required' : 'sometimes', 'string', 'min:8']],
            'categories' => ['name' => [$required, 'string', 'max:100'], 'slug' => ['sometimes', 'nullable', 'string', 'max:120'], 'description' => ['sometimes', 'nullable', 'string']],
            'products' => ['category_id' => [$required, 'integer', 'exists:categories,id'], 'name' => [$required, 'string', 'max:150'], 'slug' => ['sometimes', 'nullable', 'string', 'max:180'], 'description' => ['sometimes', 'nullable', 'string'], 'price' => [$required, 'numeric', 'min:0'], 'stock' => ['sometimes', 'integer', 'min:0'], 'tag_ids' => ['sometimes', 'array'], 'tag_ids.*' => ['integer', 'exists:tags,id']],
            'tags' => ['name' => [$required, 'string', 'max:60'], 'slug' => ['sometimes', 'nullable', 'string', 'max:80']],
            default => [],
        };
    }

    private function enrich(string $resource, object $row, Request $request): array
    {
        $data = (array) $row;
        unset($data['password'], $data['remember_token'], $data['email_verified_at']);
        $include = array_filter(explode(',', (string) $request->query('include', '')));
        if ($resource === 'products') {
            if (in_array('category', $include, true)) $data['category'] = (array) DB::table('categories')->where('id', $row->category_id)->first();
            if (in_array('tags', $include, true)) $data['tags'] = DB::table('tags')->join('product_tag', 'tags.id', '=', 'product_tag.tag_id')->where('product_tag.product_id', $row->id)->select('tags.*')->get()->map(fn($tag) => (array) $tag)->all();
        }
        if ($resource === 'categories' && in_array('products', $include, true)) $data['products'] = DB::table('products')->where('category_id', $row->id)->get()->map(fn($item) => (array) $item)->all();
        if ($resource === 'orders') {
            if (in_array('user', $include, true)) $data['user'] = $this->publicUser(DB::table('users')->where('id', $row->user_id)->first());
            if (in_array('items', $include, true) || in_array('items.product', $include, true)) $data['items'] = DB::table('order_items')->where('order_id', $row->id)->get()->map(function ($item) use ($include): array {
                $value = (array) $item;
                if (in_array('items.product', $include, true)) $value['product'] = (array) DB::table('products')->where('id', $item->product_id)->first();
                return $value;
            })->all();
        }
        if ($resource === 'comments' && in_array('user', $include, true)) $data['user'] = $this->publicUser(DB::table('users')->where('id', $row->user_id)->first());
        return $data;
    }

    private function publicUser(?object $user): ?array
    {
        return $user ? ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'created_at' => $user->created_at, 'updated_at' => $user->updated_at] : null;
    }

    private function syncTags(int $productId, array $tagIds): void
    {
        DB::table('product_tag')->where('product_id', $productId)->delete();
        foreach (array_unique($tagIds) as $tagId) DB::table('product_tag')->insertOrIgnore(['product_id' => $productId, 'tag_id' => $tagId]);
    }

    private function paginate(Request $request, $query, string $message, callable $transform, array $sortable = ['id', 'created_at', 'updated_at'])
    {
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 10)));
        $total = (clone $query)->count();
        $sort = in_array($request->query('sort', 'id'), $sortable, true) ? $request->query('sort', 'id') : 'id';
        $order = strtolower((string) $request->query('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $rows = $query->orderBy($sort, $order)->offset(($page - 1) * $limit)->limit($limit)->get();
        return response()->json(['success' => true, 'message' => $message, 'data' => $rows->map($transform)->values(), 'meta' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'total_pages' => (int) ceil($total / $limit)]]);
    }

    private function label(string $resource, bool $plural = false): string
    {
        $name = match ($resource) {
            'users' => $plural ? 'Users' : 'User',
            'categories' => $plural ? 'Categories' : 'Category',
            'products' => $plural ? 'Products' : 'Product',
            'tags' => $plural ? 'Tags' : 'Tag',
            'orders' => $plural ? 'Orders' : 'Order',
            default => $plural ? ucfirst($resource) : ucfirst(Str::singular($resource)),
        };
        return $name;
    }

    private function ownsOrAdmin(Request $request, int|string $owner): bool
    {
        $user = $request->attributes->get('apiUser');
        return $user->role === 'admin' || (int) $user->id === (int) $owner;
    }

    private function resourceFromRequest(Request $request): string
    {
        return explode('.', (string) $request->route()->getName(), 2)[0];
    }

    private function isConflict(\Illuminate\Database\QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());
        return str_contains($message, 'duplicate') || str_contains($message, 'unique');
    }

    private function ok(string $message, mixed $data)
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data]);
    }
    private function fail(int $status, string $message, ?array $errors = null)
    {
        $body = ['success' => false, 'message' => $message];
        if ($errors !== null) $body['errors'] = $errors;
        return response()->json($body, $status);
    }
}
