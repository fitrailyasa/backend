<?php

namespace App\Controllers;

use App\Models\OrderItemModel;
use App\Models\OrderModel;
use App\Models\ProductModel;
use App\Models\UserModel;

class Orders extends BaseController
{
    public function index()
    {
        $request = $this->request;
        $builder = model(OrderModel::class, false)->builder();
        $user = $this->currentUser();
        if ($user->role !== 'admin') $builder->where('user_id', $user->id);
        elseif ($request->getGet('user_id')) $builder->where('user_id', $request->getGet('user_id'));
        if ($request->getGet('status')) $builder->where('status', $request->getGet('status'));
        return $this->paginate($builder, ['id', 'created_at', 'updated_at'], 'Orders retrieved', fn (array $row) => $this->presentOrder($row));
    }

    public function show(int $id)
    {
        $row = model(OrderModel::class, false)->find($id);
        if (!$row) return $this->fail(404, 'Order not found');
        if (!$this->ownsOrAdmin((int) $row['user_id'])) return $this->fail(403, 'This action is unauthorized');
        return $this->respond('Order retrieved', $this->presentOrder($row));
    }

    public function create()
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

        $db = db_connect();
        $db->transBegin();
        try {
            $orders = model(OrderModel::class, false);
            $orders->insert(['user_id' => $this->currentUser()->id, 'status' => 'pending', 'total' => 0]);
            $orderId = (int) $orders->getInsertID();
            $totalCents = 0;
            $items = model(OrderItemModel::class, false);
            foreach ($data['items'] as $item) {
                $product = model(ProductModel::class, false)->find($item['product_id']);
                if (!$product) {
                    $db->transRollback();
                    return $this->invalid(['items' => ['A selected product does not exist.']]);
                }
                $priceCents = (int) round((float) $product['price'] * 100);
                $totalCents += $priceCents * (int) $item['quantity'];
                $items->insert([
                    'order_id' => $orderId,
                    'product_id' => $product['id'],
                    'quantity' => $item['quantity'],
                    'price' => $product['price'],
                ]);
            }
            $orders->update($orderId, ['total' => number_format($totalCents / 100, 2, '.', '')]);
            if (!$db->transStatus()) throw new \RuntimeException('Order transaction failed.');
            $db->transCommit();
        } catch (\Throwable $exception) {
            $db->transRollback();
            throw $exception;
        }
        return $this->response->setStatusCode(201)->setJSON([
            'success' => true,
            'message' => 'Order created successfully',
            'data' => $this->presentOrder(model(OrderModel::class, false)->find($orderId)),
        ]);
    }

    public function status(int $id)
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['status' => 'required|in_list[pending,paid,shipped,completed,cancelled]']);
        if ($errors) return $this->invalid($errors);
        $orders = model(OrderModel::class, false);
        $order = $orders->find($id);
        if (!$order) return $this->fail(404, 'Order not found');
        $user = $this->currentUser();
        if ($user->role !== 'admin' && ((int) $order['user_id'] !== (int) $user->id || $order['status'] !== 'pending' || $data['status'] !== 'cancelled')) {
            return $this->fail(403, 'This action is unauthorized');
        }
        $orders->update($id, ['status' => $data['status']]);
        return $this->respond('Order status updated successfully', $this->presentOrder($orders->find($id)));
    }

    public function delete(int $id)
    {
        $orders = model(OrderModel::class, false);
        if (!$orders->find($id)) return $this->fail(404, 'Order not found');
        try {
            $orders->delete($id);
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond('Order deleted successfully', null);
    }

    private function presentOrder(array $row): array
    {
        $row = $this->present($row);
        $includes = $this->includes();
        if (in_array('user', $includes, true)) {
            $user = model(UserModel::class, false)->find($row['user_id']);
            $row['user'] = $user ? $this->present($user) : null;
        }
        if (in_array('items', $includes, true) || in_array('items.product', $includes, true)) {
            $row['items'] = model(OrderItemModel::class, false)->builder()->where('order_id', $row['id'])->get()->getResultArray();
            if (in_array('items.product', $includes, true)) {
                foreach ($row['items'] as &$item) {
                    $item['product'] = model(ProductModel::class, false)->find($item['product_id']);
                }
            }
        }
        return $row;
    }
}
