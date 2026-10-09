<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\Product;
use App\Models\ProductTag;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        $query = Product::query();
        if ($request->filled('category_id')) $query->where('category_id', $request->query('category_id'));
        if ($request->filled('min_price')) $query->where('price', '>=', $request->query('min_price'));
        if ($request->filled('max_price')) $query->where('price', '<=', $request->query('max_price'));
        if ($request->filled('tag_id')) {
            $query->whereExists(fn ($sub) => $sub->selectRaw('1')->from('product_tag')->whereColumn('product_tag.product_id', 'products.id')->where('product_tag.tag_id', $request->query('tag_id')));
        }
        if ($request->filled('tag')) {
            $query->whereExists(fn ($sub) => $sub->selectRaw('1')->from('product_tag')->join('tags', 'tags.id', '=', 'product_tag.tag_id')->whereColumn('product_tag.product_id', 'products.id')->where('tags.slug', $request->query('tag')));
        }
        if ($request->filled('search')) {
            $query->where(function ($sub) use ($request): void {
                $sub->orWhere('name', 'like', '%' . $request->query('search') . '%')
                    ->orWhere('description', 'like', '%' . $request->query('search') . '%');
            });
        }

        return $this->paginate(
            $request,
            $query,
            'Products retrieved',
            ['id', 'created_at', 'updated_at', 'category_id', 'name', 'slug', 'description', 'price', 'stock'],
            fn (Product $product) => $this->present($product, $request),
        );
    }

    public function show(Request $request, int $id)
    {
        $product = Product::query()->find($id);
        if (!$product) return $this->fail(404, 'Product not found');
        return $this->ok('Product retrieved', $this->present($product, $request));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->rules(true));
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['category_id', 'name', 'slug', 'description', 'price', 'stock']);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        try {
            $product = Product::query()->create($data);
            $this->syncTags($product->id, $request->input('tag_ids', []));
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->created('Product created successfully', $this->present($product->fresh(), $request));
    }

    public function update(Request $request, int $id)
    {
        $product = Product::query()->find($id);
        if (!$product) return $this->fail(404, 'Product not found');
        $validator = Validator::make($request->all(), $this->rules(false));
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['category_id', 'name', 'slug', 'description', 'price', 'stock']);
        if (isset($data['name']) && empty($data['slug'])) $data['slug'] = Str::slug($data['name']);
        $data['updated_at'] = now();
        try {
            Product::query()->where('id', $id)->update($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        if ($request->has('tag_ids')) $this->syncTags($id, $request->input('tag_ids', []));
        return $this->ok('Product updated successfully', $this->present(Product::query()->find($id), $request));
    }

    public function destroy(int $id)
    {
        $product = Product::query()->find($id);
        if (!$product) return $this->fail(404, 'Product not found');
        try {
            $product->delete();
        } catch (QueryException $exception) {
            if ($this->isForeignKey($exception)) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok('Product deleted successfully', null);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';
        return [
            'category_id' => [$required, 'integer', 'exists:categories,id'],
            'name' => [$required, 'string', 'max:150'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:180'],
            'description' => ['sometimes', 'nullable', 'string'],
            'price' => [$required, 'numeric', 'min:0'],
            'stock' => ['sometimes', 'integer', 'min:0'],
            'tag_ids' => ['sometimes', 'array'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
        ];
    }

    private function syncTags(int $productId, array $tagIds): void
    {
        ProductTag::query()->where('product_id', $productId)->delete();
        foreach (array_unique($tagIds) as $tagId) {
            ProductTag::query()->insertOrIgnore(['product_id' => $productId, 'tag_id' => $tagId]);
        }
    }

    private function present(Product $product, Request $request): array
    {
        $data = $product->toApi();
        $include = $this->includes($request);
        if (in_array('category', $include, true)) {
            $category = $product->category;
            $data['category'] = $category ? $category->toApi() : [];
        }
        if (in_array('tags', $include, true)) {
            $data['tags'] = $product->tags->map(fn ($tag) => $tag->toApi())->all();
        }
        return $data;
    }
}
