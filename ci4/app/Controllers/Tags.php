<?php

namespace App\Controllers;

use App\Models\TagModel;

class Tags extends BaseController
{
    public function index()
    {
        $builder = model(TagModel::class, false)->builder();
        $this->search($builder, ['name']);
        return $this->paginate($builder, ['id', 'created_at', 'updated_at', 'name', 'slug'], 'Tags retrieved', fn (array $row) => $this->present($row), []);
    }

    public function show(int $id)
    {
        $row = model(TagModel::class, false)->find($id);
        if (!$row) return $this->fail(404, 'Tag not found');
        return $this->respond('Tag retrieved', $this->present($row));
    }

    public function create()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => $this->textRule(true, 2, 60, 'Name'),
            'slug' => $this->slugRule(80),
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'slug']));
        if (empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if ($this->taken(TagModel::class, 'slug', $values['slug'])) return $this->fail(409, 'Slug already exists');
        $tags = model(TagModel::class, false);
        try {
            $tags->insert($values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->response->setStatusCode(201)->setJSON([
            'success' => true,
            'message' => 'Tag created successfully',
            'data' => $this->present($tags->find($tags->getInsertID())),
        ]);
    }

    public function update(int $id)
    {
        $tags = model(TagModel::class, false);
        if (!$tags->find($id)) return $this->fail(404, 'Tag not found');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => $this->textRule(false, 2, 60, 'Name'),
            'slug' => $this->slugRule(80),
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'slug']));
        if (isset($values['name']) && empty($values['slug'])) $values['slug'] = $this->slug($values['name']);
        if (isset($values['slug']) && $this->taken(TagModel::class, 'slug', $values['slug'], $id)) return $this->fail(409, 'Slug already exists');
        try {
            $tags->update($id, $values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->respond('Tag updated successfully', $this->present($tags->find($id)));
    }

    public function delete(int $id)
    {
        $tags = model(TagModel::class, false);
        if (!$tags->find($id)) return $this->fail(404, 'Tag not found');
        try {
            $tags->delete($id);
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond('Tag deleted successfully', null);
    }
}
