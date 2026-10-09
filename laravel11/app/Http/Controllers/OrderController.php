<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Database\QueryException;

class OrderController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        $query = Order::query();
        $user = $request->attributes->get('apiUser');
        if ($user->role !== 'admin') $query->where('user_id', $user->id);
        if ($user->role === 'admin' && $request->filled('user_id')) $query->where('user_id', $request->query('user_id'));
        if ($request->filled('status')) $query->where('status', $request->query('status'));

        return $this->paginate(
            $request,
            $query,
            'Orders retrieved',
            ['id', 'created_at', 'updated_at'],
            fn (Order $order) => $this->present($order, $request),
        );
    }

    public function show(Request $request, int $id)
    {
        $order = Order::query()->find($id);
        if (!$order) return $this->fail(404, 'Order not found');
        if (!$this->ownsOrAdmin($request, $order->user_id)) return $this->fail(403, 'This action is unauthorized');
        return $this->ok('Order retrieved', $this->present($order, $request));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $order = DB::transaction(function () use ($request) {
            $user = $request->attributes->get('apiUser');
            $created = Order::query()->create([
                'user_id' => $user->id,
                'status' => 'pending',
                'total' => 0,
            ]);
            $totalCents = 0;
            foreach ($request->input('items') as $item) {
                $product = Product::query()->where('id', $item['product_id'])->lockForUpdate()->first();
                $totalCents += (int) round((float) $product->price * 100) * (int) $item['quantity'];
                OrderItem::query()->create([
                    'order_id' => $created->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'price' => $product->price,
                ]);
            }
            $created->update(['total' => number_format($totalCents / 100, 2, '.', '')]);
            return $created->fresh();
        });

        return $this->created('Order created successfully', $this->present($order, $request));
    }

    public function status(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(['pending', 'paid', 'shipped', 'completed', 'cancelled'])],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $order = Order::query()->find($id);
        if (!$order) return $this->fail(404, 'Order not found');
        $user = $request->attributes->get('apiUser');
        if ($user->role !== 'admin' && ((int) $order->user_id !== (int) $user->id || $order->status !== 'pending' || $request->input('status') !== 'cancelled')) {
            return $this->fail(403, 'This action is unauthorized');
        }
        $order->update(['status' => $request->input('status'), 'updated_at' => now()]);
        return $this->ok('Order status updated successfully', $this->present($order->fresh(), $request));
    }

    public function destroy(int $id)
    {
        $order = Order::query()->find($id);
        if (!$order) return $this->fail(404, 'Order not found');
        try {
            $order->delete();
        } catch (QueryException $exception) {
            if ($this->isForeignKey($exception)) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok('Order deleted successfully', null);
    }

    private function present(Order $order, Request $request): array
    {
        $data = $order->toApi();
        $include = $this->includes($request);
        if (in_array('user', $include, true)) {
            $user = $order->user;
            $data['user'] = $user ? $user->toApi() : null;
        }
        if (in_array('items', $include, true) || in_array('items.product', $include, true)) {
            $data['items'] = $order->items->map(function (OrderItem $item) use ($include) {
                $value = $item->toApi();
                if (in_array('items.product', $include, true)) {
                    $product = $item->product;
                    $value['product'] = $product ? $product->toApi() : [];
                }
                return $value;
            })->all();
        }
        return $data;
    }
}
