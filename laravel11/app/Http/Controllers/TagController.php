<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\Tag;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class TagController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        $query = Tag::query();
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->query('search') . '%');
        }

        return $this->paginate(
            $request,
            $query,
            'Tags retrieved',
            ['id', 'created_at', 'updated_at', 'name', 'slug'],
            fn (Tag $tag) => $tag->toApi(),
            [],
        );
    }

    public function show(int $id)
    {
        $tag = Tag::query()->find($id);
        if (!$tag) return $this->fail(404, 'Tag not found');
        return $this->ok('Tag retrieved', $tag->toApi());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
        ], [
            'name.required' => 'Name is required.',
            'name.min' => 'Name must be between 2 and 60 characters.',
            'name.max' => 'Name must be between 2 and 60 characters.',
            'slug.max' => 'Slug must be between 1 and 80 characters.',
            'slug.regex' => 'Slug may only contain lowercase letters, numbers and single hyphens.',
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'slug']);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        try {
            $tag = Tag::query()->create($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->created('Tag created successfully', $tag->fresh()->toApi());
    }

    public function update(Request $request, int $id)
    {
        $tag = Tag::query()->find($id);
        if (!$tag) return $this->fail(404, 'Tag not found');
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'nullable', 'string', 'min:2', 'max:60'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
        ], [
            'name.min' => 'Name must be between 2 and 60 characters.',
            'name.max' => 'Name must be between 2 and 60 characters.',
            'slug.max' => 'Slug must be between 1 and 80 characters.',
            'slug.regex' => 'Slug may only contain lowercase letters, numbers and single hyphens.',
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'slug']);
        if (isset($data['name']) && empty($data['slug'])) $data['slug'] = Str::slug($data['name']);
        $data['updated_at'] = now();
        try {
            Tag::query()->where('id', $id)->update($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->ok('Tag updated successfully', Tag::query()->find($id)->toApi());
    }

    public function destroy(int $id)
    {
        $tag = Tag::query()->find($id);
        if (!$tag) return $this->fail(404, 'Tag not found');
        try {
            $tag->delete();
        } catch (QueryException $exception) {
            if ($this->isForeignKey($exception)) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok('Tag deleted successfully', null);
    }
}
