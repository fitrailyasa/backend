<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\Category;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        $query = Category::query();
        if ($request->filled('search')) {
            $query->where(function ($sub) use ($request): void {
                $sub->orWhere('name', 'like', '%' . $request->query('search') . '%')
                    ->orWhere('description', 'like', '%' . $request->query('search') . '%');
            });
        }

        return $this->paginate(
            $request,
            $query,
            'Categories retrieved',
            ['id', 'created_at', 'updated_at', 'name', 'slug', 'description'],
            fn (Category $category) => $this->present($category, $request),
        );
    }

    public function show(Request $request, int $id)
    {
        $category = Category::query()->find($id);
        if (!$category) return $this->fail(404, 'Category not found');
        return $this->ok('Category retrieved', $this->present($category, $request));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'slug', 'description']);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        try {
            $category = Category::query()->create($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->created('Category created successfully', $this->present($category->fresh(), $request));
    }

    public function update(Request $request, int $id)
    {
        $category = Category::query()->find($id);
        if (!$category) return $this->fail(404, 'Category not found');
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:100'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'slug', 'description']);
        if (isset($data['name']) && empty($data['slug'])) $data['slug'] = Str::slug($data['name']);
        $data['updated_at'] = now();
        try {
            Category::query()->where('id', $id)->update($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->ok('Category updated successfully', $this->present(Category::query()->find($id), $request));
    }

    public function destroy(int $id)
    {
        $category = Category::query()->find($id);
        if (!$category) return $this->fail(404, 'Category not found');
        try {
            $category->delete();
        } catch (QueryException $exception) {
            if ($this->isForeignKey($exception)) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok('Category deleted successfully', null);
    }

    private function present(Category $category, Request $request): array
    {
        $data = $category->toApi();
        if (in_array('products', $this->includes($request), true)) {
            $data['products'] = $category->products->map(fn ($product) => $product->toApi())->all();
        }
        return $data;
    }
}
