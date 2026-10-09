<?php

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Models\ProductModel;

class Categories extends BaseController
{
    public function index()
    {
        $builder = model(CategoryModel::class, false)->builder();
        $this->search($builder, ['name', 'description']);
        return $this->paginate($builder, ['id', 'created_at', 'updated_at', 'name', 'slug', 'description'], 'Categories retrieved', fn (array $row) => $this->presentCategory($row));
    }

    public function show(int $id)
    {
        $row = model(CategoryModel::class, false)->find($id);
        if (!$row) return $this->fail(404, 'Category not found');
        return $this->respond('Category retrieved', $this->presentCategory($row));
    }

    public function create()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => 'required|string|max_length[100]',
            'slug' => 'permit_empty|string|max_length[120]',
            'description' => 'permit_empty|string',
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'slug', 'description']));
        if (empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if ($this->taken(CategoryModel::class, 'slug', $values['slug'])) return $this->fail(409, 'Slug already exists');
        $categories = model(CategoryModel::class, false);
        try {
            $categories->insert($values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->response->setStatusCode(201)->setJSON([
            'success' => true,
            'message' => 'Category created successfully',
            'data' => $this->presentCategory($categories->find($categories->getInsertID())),
        ]);
    }

    public function update(int $id)
    {
        $categories = model(CategoryModel::class, false);
        $row = $categories->find($id);
        if (!$row) return $this->fail(404, 'Category not found');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => 'permit_empty|string|max_length[100]',
            'slug' => 'permit_empty|string|max_length[120]',
            'description' => 'permit_empty|string',
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'slug', 'description']));
        if (isset($values['name']) && empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if (isset($values['slug']) && $this->taken(CategoryModel::class, 'slug', $values['slug'], $id)) return $this->fail(409, 'Slug already exists');
        try {
            $categories->update($id, $values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->respond('Category updated successfully', $this->presentCategory($categories->find($id)));
    }

    public function delete(int $id)
    {
        $categories = model(CategoryModel::class, false);
        if (!$categories->find($id)) return $this->fail(404, 'Category not found');
        try {
            $categories->delete($id);
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond('Category deleted successfully', null);
    }

    private function presentCategory(array $row): array
    {
        $row = $this->present($row);
        if (in_array('products', $this->includes(), true)) {
            $row['products'] = model(ProductModel::class, false)->builder()->where('category_id', $row['id'])->get()->getResultArray();
        }
        return $row;
    }
}
