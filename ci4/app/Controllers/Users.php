<?php

namespace App\Controllers;

use App\Models\UserModel;

class Users extends BaseController
{
    public function index()
    {
        $builder = model(UserModel::class, false)->builder()->select('id, name, email, role, created_at, updated_at');
        $this->search($builder, ['name', 'email']);
        return $this->paginate($builder, ['id', 'created_at', 'updated_at', 'name', 'email', 'role'], 'Users retrieved', fn (array $row) => $this->present($row), []);
    }

    public function show(int $id)
    {
        $row = model(UserModel::class, false)->find($id);
        if (!$row) return $this->fail(404, 'User not found');
        return $this->respond('User retrieved', $this->present($row));
    }

    public function create()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => $this->textRule(true, 2, 100, 'Name'),
            'email' => $this->emailRule(),
            'role' => ['rules' => 'permit_empty|in_list[user,admin]', 'errors' => ['in_list' => 'Role must be one of: user, admin.']],
            'password' => $this->passwordRule(),
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'email', 'role']));
        $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        if ($this->taken(UserModel::class, 'email', $values['email'])) return $this->fail(409, 'Email already exists');
        $users = model(UserModel::class, false);
        try {
            $users->insert($values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        $row = $users->find($users->getInsertID());
        return $this->response->setStatusCode(201)->setJSON(['success' => true, 'message' => 'User created successfully', 'data' => $this->present($row)]);
    }

    public function update(int $id)
    {
        $users = model(UserModel::class, false);
        $row = $users->find($id);
        if (!$row) return $this->fail(404, 'User not found');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => $this->textRule(false, 2, 100, 'Name'),
            'email' => $this->emailRule(false),
            'role' => ['rules' => 'permit_empty|in_list[user,admin]', 'errors' => ['in_list' => 'Role must be one of: user, admin.']],
            'password' => $this->passwordRule(false),
        ]);
        if ($errors) return $this->invalid($errors);
        $values = array_intersect_key($data, array_flip(['name', 'email', 'role']));
        if (!empty($data['password'])) $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        if (isset($values['email']) && $this->taken(UserModel::class, 'email', $values['email'], $id)) return $this->fail(409, 'Email already exists');
        try {
            $users->update($id, $values);
        } catch (\Throwable $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->respond('User updated successfully', $this->present($users->find($id)));
    }

    public function delete(int $id)
    {
        $users = model(UserModel::class, false);
        if (!$users->find($id)) return $this->fail(404, 'User not found');
        try {
            $users->delete($id);
        } catch (\Throwable $exception) {
            $message = strtolower($exception->getMessage());
            if (str_contains($message, 'foreign key') || str_contains($message, 'constraint fails')) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->respond('User deleted successfully', null);
    }

    public function me()
    {
        $user = $this->currentUser();
        if ((int) $user->id === 0) return $this->fail(401, 'Unauthenticated');
        $row = model(UserModel::class, false)->builder()->select('id, name, email, role, created_at, updated_at')->where('id', $user->id)->get()->getRowArray();
        return $row ? $this->respond('User retrieved', $row) : $this->fail(401, 'Unauthenticated');
    }

    public function updateMe()
    {
        $current = $this->currentUser();
        if ((int) $current->id === 0) return $this->fail(401, 'Unauthenticated');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $errors = $this->validatePayload($data, [
            'name' => $this->textRule(false, 2, 100, 'Name'),
            'email' => $this->emailRule(false),
            'password' => $this->passwordRule(false),
        ]);
        if ($errors) return $this->invalid($errors);
        if (isset($data['password_confirmation']) && ($data['password_confirmation'] ?? null) !== ($data['password'] ?? null)) {
            return $this->invalid(['password_confirmation' => ['password_confirmation must match password.']]);
        }

        $users = model(UserModel::class, false);
        $user = $users->find($current->id);
        if (!$user) return $this->fail(401, 'Unauthenticated');
        if (!empty($data['email']) && $data['email'] !== $user['email'] && $users->builder()->where('email', $data['email'])->countAllResults() > 0) {
            return $this->invalid(['email' => ['The email has already been taken.']]);
        }

        $values = [];
        if (!empty($data['name'])) $values['name'] = $data['name'];
        if (!empty($data['email'])) $values['email'] = $data['email'];
        if (!empty($data['password'])) $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        if ($values === []) {
            $users->builder()->where('id', $user['id'])->update(['updated_at' => date('Y-m-d H:i:s')]);
        } else {
            $users->update($user['id'], $values);
        }
        $fresh = $users->builder()->select('id, name, email, role, created_at, updated_at')->where('id', $user['id'])->get()->getRowArray();
        return $this->respond('Profile updated successfully', $fresh);
    }
}
