<?php

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\ProductTagModel;
use App\Models\TagModel;

class Products extends BaseController
{
    public function index()
    {
        $request = $this->request;
        $products = model(ProductModel::class, false);
        $builder = $products->builder();
        if ($request->getGet('category_id') !== null) $builder->where('category_id', $request->getGet('category_id'));
        if ($request->getGet('min_price') !== null) $builder->where('price >=', $request->getGet('min_price'));
        if ($request->getGet('max_price') !== null) $builder->where('price <=', $request->getGet('max_price'));
        if ($request->getGet('tag_id') || $request->getGet('tag')) {
            $tags = model(ProductTagModel::class, false)->builder()->select('product_id')->join('tags', 'tags.id = product_tag.tag_id');
            if ($request->getGet('tag_id')) $tags->where('tag_id', $request->getGet('tag_id'));
            else $tags->where('tags.slug', $request->getGet('tag'));
            $ids = array_column($tags->get()->getResultArray(), 'product_id');
            $builder->whereIn('id', $ids ?: [0]);
        }
        $this->search($builder, ['name', 'description']);
        return $this->paginate($builder, ['id', 'created_at', 'updated_at', 'category_id', 'name', 'slug', 'description', 'price', 'stock'], 'Products retrieved', fn (array $row) => $this->presentProduct($row));
    }

    public function show(int $id)
    {
        $row = model(ProductModel::class, false)->find($id);
        if (!$row) return $this->fail(404, 'Product not found');
        return $this->respond('Product retrieved', $this->presentProduct($row));
    }

    public function create()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->productErrors($data, true);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['category_id', 'name', 'slug', 'description', 'price', 'stock']));
        if (empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if ($this->taken(ProductModel::class, 'slug', $values['slug'])) return $this->fail(409, 'Slug already exists');
        $products = model(ProductModel::class, false);
        try {
            $products->insert($values);
            $id = (int) $products->getInsertID();
            model(ProductTagModel::class, false)->sync($id, $data['tag_ids'] ?? []);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->response->setStatusCode(201)->setJSON([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $this->presentProduct($products->find($id)),
        ]);
    }

    public function update(int $id)
    {
        $products = model(ProductModel::class, false);
        if (!$products->find($id)) return $this->fail(404, 'Product not found');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->productErrors($data, false);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['category_id', 'name', 'slug', 'description', 'price', 'stock']));
        if (isset($values['name']) && empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if (isset($values['slug']) && $this->taken(ProductModel::class, 'slug', $values['slug'], $id)) return $this->fail(409, 'Slug already exists');
        try {
            $products->update($id, $values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        if (array_key_exists('tag_ids', $data)) model(ProductTagModel::class, false)->sync($id, $data['tag_ids']);
        return $this->respond('Product updated successfully', $this->presentProduct($products->find($id)));
    }

    public function delete(int $id)
    {
        $products = model(ProductModel::class, false);
        if (!$products->find($id)) return $this->fail(404, 'Product not found');
        try {
            $products->delete($id);
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond('Product deleted successfully', null);
    }

    private function productErrors(array $data, bool $creating): array
    {
        $required = $creating ? 'required|' : 'permit_empty|';
        $errors = $this->validatePayload($data, [
            'category_id' => $required . 'is_natural_no_zero',
            'name' => $required . 'string|max_length[150]',
            'slug' => 'permit_empty|string|max_length[180]',
            'description' => 'permit_empty|string',
            'price' => $required . 'decimal|greater_than_equal_to[0]',
            'stock' => 'permit_empty|integer|greater_than_equal_to[0]',
            'tag_ids' => 'permit_empty',
        ]);
        if (isset($data['category_id']) && !model(CategoryModel::class, false)->builder()->where('id', $data['category_id'])->countAllResults()) {
            $errors['category_id'] = ['The selected category_id is invalid.'];
        }
        if (isset($data['tag_ids'])) {
            if (!is_array($data['tag_ids'])) $errors['tag_ids'] = ['The tag_ids field must be an array.'];
            else {
                foreach ($data['tag_ids'] as $tagId) {
                    if (!model(TagModel::class, false)->builder()->where('id', $tagId)->countAllResults()) {
                        $errors['tag_ids'] = ['The selected tag_ids field is invalid.'];
                        break;
                    }
                }
            }
        }
        return $errors;
    }

    private function presentProduct(array $row): array
    {
        $row = $this->present($row);
        $includes = $this->includes();
        if (in_array('category', $includes, true)) {
            $row['category'] = model(CategoryModel::class, false)->find($row['category_id']);
        }
        if (in_array('tags', $includes, true)) {
            $row['tags'] = model(TagModel::class, false)->forProduct((int) $row['id']);
        }
        return $row;
    }
}
