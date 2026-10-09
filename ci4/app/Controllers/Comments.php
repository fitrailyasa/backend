<?php

namespace App\Controllers;

use App\Models\CommentModel;
use App\Models\ProductModel;
use App\Models\UserModel;

class Comments extends BaseController
{
    public function index()
    {
        return $this->listing(null);
    }

    public function forProduct(int $productId)
    {
        if (!model(ProductModel::class, false)->builder()->where('id', $productId)->countAllResults()) return $this->fail(404, 'Product not found');
        return $this->listing($productId);
    }

    public function create(int $productId)
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['body' => 'required|string']);
        if ($errors) return $this->invalid($errors);
        if (!model(ProductModel::class, false)->builder()->where('id', $productId)->countAllResults()) return $this->fail(404, 'Product not found');
        $comments = model(CommentModel::class, false);
        $comments->insert([
            'product_id' => $productId,
            'user_id' => $this->currentUser()->id,
            'body' => $data['body'],
        ]);
        return $this->response->setStatusCode(201)->setJSON([
            'success' => true,
            'message' => 'Comment created successfully',
            'data' => $this->presentComment($comments->find($comments->getInsertID())),
        ]);
    }

    public function update(int $id)
    {
        $comments = model(CommentModel::class, false);
        $comment = $comments->find($id);
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin((int) $comment['user_id'])) return $this->fail(403, 'This action is unauthorized');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, ['body' => 'required|string']);
        if ($errors) return $this->invalid($errors);
        $comments->update($id, ['body' => $data['body']]);
        return $this->respond('Comment updated successfully', $this->presentComment($comments->find($id)));
    }

    public function delete(int $id)
    {
        $comments = model(CommentModel::class, false);
        $comment = $comments->find($id);
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin((int) $comment['user_id'])) return $this->fail(403, 'This action is unauthorized');
        $comments->delete($id);
        return $this->respond('Comment deleted successfully', null);
    }

    private function listing(?int $productId)
    {
        $request = $this->request;
        $builder = model(CommentModel::class, false)->builder();
        if ($productId !== null) $builder->where('product_id', $productId);
        elseif ($request->getGet('product_id') !== null) $builder->where('product_id', $request->getGet('product_id'));
        if ($request->getGet('user_id') !== null) $builder->where('user_id', $request->getGet('user_id'));
        $this->search($builder, ['body']);
        return $this->paginate($builder, ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at'], 'Comments retrieved', fn (array $row) => $this->presentComment($row));
    }

    private function presentComment(array $row): array
    {
        $row = $this->present($row);
        if (in_array('user', $this->includes(), true)) {
            $user = model(UserModel::class, false)->find($row['user_id']);
            $row['user'] = $user ? $this->present($user) : null;
        }
        return $row;
    }
}
