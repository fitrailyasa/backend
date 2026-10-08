<?php

namespace App\Controllers;

use App\Libraries\JwtToken;
use Config\Database;

class Auth extends BaseController
{
    public function register()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $validation = service('validation');
        if (!$validation->setRules([
            'name' => 'required|string|max_length[100]',
            'email' => 'required|valid_email|max_length[150]',
            'password' => 'required|string|min_length[8]',
            'password_confirmation' => 'required|string',
        ])->run($data)) return $this->invalid($validation->getErrors());
        if ($data['password'] !== $data['password_confirmation']) return $this->invalid(['password_confirmation' => 'The password confirmation does not match.']);

        $db = Database::connect();
        if ($db->table('users')->where('email', $data['email'])->countAllResults() > 0) return $this->fail(409, 'Email already exists');
        $now = date('Y-m-d H:i:s');
        $db->table('users')->insert([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => password_hash($data['password'], PASSWORD_BCRYPT),
            'role' => 'user',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        return $this->issue($db->table('users')->where('id', $db->insertID())->get()->getRow(), 201);
    }

    public function login()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $validation = service('validation');
        if (!$validation->setRules(['email' => 'required|valid_email', 'password' => 'required|string'])->run($data)) return $this->invalid($validation->getErrors());
        $user = Database::connect()->table('users')->where('email', $data['email'])->get()->getRow();
        if (!$user || !$this->passwordMatches((string) $data['password'], (string) $user->password)) return $this->fail(401, 'These credentials do not match our records');
        return $this->issue($user);
    }

    public function refresh()
    {
        $claims = $this->claims('refresh');
        if (!$claims) return $this->fail(401, 'Unauthenticated');
        $user = Database::connect()->table('users')->where('id', $claims['sub'])->get()->getRow();
        if (!$user) return $this->fail(401, 'Unauthenticated');
        JwtToken::revoke($claims);
        return $this->respond('Token refreshed successfully', $this->tokenPayload($user));
    }

    public function logout()
    {
        $claims = $this->claims();
        if (!$claims) return $this->fail(401, 'Unauthenticated');
        JwtToken::revoke($claims);
        return $this->respond('Logged out successfully', null);
    }

    public function me()
    {
        $claims = $this->claims();
        $user = $claims ? Database::connect()->table('users')->select('id, name, email, role, created_at, updated_at')->where('id', $claims['sub'])->get()->getRowArray() : null;
        $message = str_contains($this->request->getUri()->getPath(), 'auth/me') ? 'Authenticated user retrieved' : 'User retrieved';
        return $user ? $this->respond($message, $user) : $this->fail(401, 'Unauthenticated');
    }

    public function updateMe()
    {
        $claims = $this->claims();
        if (!$claims) return $this->fail(401, 'Unauthenticated');
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $rules = [
            'name' => 'permit_empty|string|max_length[100]',
            'email' => 'permit_empty|valid_email|max_length[150]',
            'password' => 'permit_empty|string|min_length[8]',
        ];
        $validation = service('validation');
        if (!$validation->setRules($rules)->run($data)) return $this->invalid($validation->getErrors());
        if (isset($data['password_confirmation']) && ($data['password_confirmation'] ?? null) !== ($data['password'] ?? null)) {
            return $this->invalid(['password_confirmation' => 'password_confirmation must match password.']);
        }

        $db = Database::connect();
        $user = $db->table('users')->where('id', $claims['sub'])->get()->getRow();
        if (!$user) return $this->fail(401, 'Unauthenticated');
        if (!empty($data['email']) && $data['email'] !== $user->email && $db->table('users')->where('email', $data['email'])->countAllResults() > 0) {
            return $this->invalid(['email' => 'The email has already been taken.']);
        }

        $values = ['updated_at' => date('Y-m-d H:i:s')];
        if (!empty($data['name'])) $values['name'] = $data['name'];
        if (!empty($data['email'])) $values['email'] = $data['email'];
        if (!empty($data['password'])) $values['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        $db->table('users')->where('id', $user->id)->update($values);
        $fresh = $db->table('users')->select('id, name, email, role, created_at, updated_at')->where('id', $user->id)->get()->getRowArray();
        return $this->respond('Profile updated successfully', $fresh);
    }

    private function issue(object $user, int $status = 200)
    {
        return $this->response->setStatusCode($status)->setJSON([
            'success' => true,
            'message' => $status === 201 ? 'User registered successfully' : 'Login successful',
            'data' => $this->tokenPayload($user),
        ]);
    }

    private function passwordMatches(string $plain, string $hash): bool
    {
        if (str_starts_with($hash, 'bcrypt$')) $hash = substr($hash, strlen('bcrypt$'));
        return $hash !== '' && password_verify($plain, $hash);
    }

    private function tokenPayload(object $user): array
    {
        return [
            'user' => $this->publicUser($user),
            'token' => JwtToken::issue($user),
            'refresh_token' => JwtToken::issue($user, 'refresh'),
            'token_type' => 'Bearer',
            'expires_in' => (int) env('JWT_EXPIRES_IN', 3600),
        ];
    }

    private function publicUser(object $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'created_at' => $user->created_at, 'updated_at' => $user->updated_at];
    }

    private function claims(string $type = 'access'): ?array
    {
        $header = $this->request->getHeaderLine('Authorization');
        $token = preg_match('/^Bearer\s+(.+)$/i', $header, $matches) ? $matches[1] : '';
        if ($type === 'refresh' && $token === '') {
            $payload = $this->input();
            $token = (string) ($payload['refresh_token'] ?? '');
        }
        return $token !== '' ? JwtToken::decode($token, $type) : null;
    }

    private function input(): array
    {
        $raw = $this->request->getBody();
        if ($raw !== '' && json_decode($raw) === null && json_last_error() !== JSON_ERROR_NONE) {
            return ['_malformed_json' => true];
        }
        return $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
    }

    private function invalid(array $errors)
    {
        $messages = [];
        foreach ($errors as $field => $message) $messages[$field] = (array) $message;
        return $this->response->setStatusCode(422)->setJSON(['success' => false, 'message' => 'Validation failed', 'errors' => $messages]);
    }

    private function respond(string $message, mixed $data)
    {
        return $this->response->setJSON(['success' => true, 'message' => $message, 'data' => $data]);
    }

    private function fail(int $status, string $message)
    {
        return $this->response->setStatusCode($status)->setJSON(['success' => false, 'message' => $message]);
    }
}
