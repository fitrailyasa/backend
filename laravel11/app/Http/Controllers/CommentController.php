<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\Comment;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CommentController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        return $this->listing($request, null);
    }

    public function forProduct(Request $request, int $productId)
    {
        if (!Product::query()->where('id', $productId)->exists()) return $this->fail(404, 'Product not found');
        return $this->listing($request, $productId);
    }

    public function store(Request $request, int $productId)
    {
        $validator = Validator::make($request->all(), ['body' => ['required', 'string']]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        if (!Product::query()->where('id', $productId)->exists()) return $this->fail(404, 'Product not found');

        $comment = Comment::query()->create([
            'product_id' => $productId,
            'user_id' => $request->attributes->get('apiUser')->id,
            'body' => $request->input('body'),
        ]);
        return $this->created('Comment created successfully', $this->present($comment->fresh(), $request));
    }

    public function update(Request $request, int $id)
    {
        $comment = Comment::query()->find($id);
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin($request, $comment->user_id)) return $this->fail(403, 'This action is unauthorized');
        $validator = Validator::make($request->all(), ['body' => ['required', 'string']]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());
        $comment->update(['body' => $request->input('body'), 'updated_at' => now()]);
        return $this->ok('Comment updated successfully', $this->present($comment->fresh(), $request));
    }

    public function destroy(Request $request, int $id)
    {
        $comment = Comment::query()->find($id);
        if (!$comment) return $this->fail(404, 'Comment not found');
        if (!$this->ownsOrAdmin($request, $comment->user_id)) return $this->fail(403, 'This action is unauthorized');
        $comment->delete();
        return $this->ok('Comment deleted successfully', null);
    }

    private function listing(Request $request, ?int $productId)
    {
        $query = Comment::query();
        if ($productId !== null) $query->where('product_id', $productId);
        elseif ($request->filled('product_id')) $query->where('product_id', $request->query('product_id'));
        if ($request->filled('user_id')) $query->where('user_id', $request->query('user_id'));
        if ($request->filled('search')) $query->where('body', 'like', '%' . $request->query('search') . '%');

        return $this->paginate(
            $request,
            $query,
            'Comments retrieved',
            ['id', 'body', 'product_id', 'user_id', 'created_at', 'updated_at'],
            fn (Comment $comment) => $this->present($comment, $request),
        );
    }

    private function present(Comment $comment, Request $request): array
    {
        $data = $comment->toApi();
        if (in_array('user', $this->includes($request), true)) {
            $user = $comment->user;
            $data['user'] = $user ? $user->toApi() : null;
        }
        return $data;
    }
}
