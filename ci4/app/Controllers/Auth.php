<?php

namespace App\Controllers;

use App\Libraries\JwtToken;
use App\Models\UserModel;

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

        $users = model(UserModel::class, false);
        if ($users->builder()->where('email', $data['email'])->countAllResults() > 0) return $this->fail(409, 'Email already exists');
        $users->insert([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => password_hash($data['password'], PASSWORD_BCRYPT),
            'role' => 'user',
        ]);
        return $this->issue((object) $users->find($users->getInsertID()), 201);
    }

    public function login()
    {
        $data = $this->input();
        if (isset($data['_malformed_json'])) return $this->fail(400, 'Invalid JSON');
        $validation = service('validation');
        if (!$validation->setRules(['email' => 'required|valid_email', 'password' => 'required|string'])->run($data)) return $this->invalid($validation->getErrors());
        $user = model(UserModel::class, false)->builder()->where('email', $data['email'])->get()->getRow();
        if (!$user || !$this->passwordMatches((string) $data['password'], (string) $user->password)) return $this->fail(401, 'These credentials do not match our records');
        return $this->issue($user);
    }

    public function refresh()
    {
        $claims = $this->claims('refresh');
        if (!$claims) return $this->fail(401, 'Unauthenticated');
        $user = model(UserModel::class, false)->builder()->where('id', $claims['sub'])->get()->getRow();
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
        $user = $claims ? model(UserModel::class, false)->builder()->select('id, name, email, role, created_at, updated_at')->where('id', $claims['sub'])->get()->getRowArray() : null;
        return $user ? $this->respond('Authenticated user retrieved', $user) : $this->fail(401, 'Unauthenticated');
    }

    protected function invalid(array $errors)
    {
        $messages = [];
        foreach ($errors as $field => $message) $messages[$field] = (array) $message;
        return parent::invalid($messages);
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
}
