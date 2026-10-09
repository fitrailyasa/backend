<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_index_and_health_are_public(): void
    {
        $this->getJson('/api/v1')->assertOk()->assertJsonPath('success', true);
        $this->getJson('/api/v1/health')->assertOk()->assertJsonPath('status', 'ok');
    }

    public function test_register_rejects_invalid_fields(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'A',
            'email' => 'bad',
            'password' => 'short',
            'password_confirmation' => 'nope',
        ])->assertStatus(422)->assertJsonStructure([
            'errors' => ['name', 'email', 'password', 'password_confirmation'],
        ]);
    }

    public function test_login_rejects_unknown_credentials_and_accepts_a_real_user(): void
    {
        $this->postJson('/api/v1/auth/login', [])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['email', 'password']]);

        $this->user('user@example.com');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.com',
            'password' => 'wrong-password',
        ])->assertUnauthorized();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.com',
            'password' => 'password',
        ])->assertOk()->assertJsonPath('message', 'Login successful');

        $this->assertIsString($login->json('data.token'));
        $this->assertArrayNotHasKey('password', $login->json('data.user'));
    }

    public function test_logout_revokes_the_access_token(): void
    {
        $token = $this->tokenFor($this->user('member@example.com'));

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_category_queries_and_writes_are_validated(): void
    {
        $this->getJson('/api/v1/categories?page=0&limit=0&sort=nope&order=sideways&include=nope')
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['page', 'limit', 'sort', 'order', 'include']]);

        $this->postJson('/api/v1/categories', ['name' => 'Valid Name'])
            ->assertUnauthorized();

        $admin = $this->tokenFor($this->user('admin@example.com', 'admin'));

        $this->withToken($admin)->postJson('/api/v1/categories', [
            'name' => 'X',
            'slug' => 'Bad Slug',
        ])->assertStatus(422)->assertJsonStructure(['errors' => ['name', 'slug']]);

        $this->withToken($admin)->postJson('/api/v1/categories', [
            'name' => 'Valid Category Name',
        ])->assertCreated()->assertJsonPath('data.slug', 'valid-category-name');
    }

    private function user(string $email, string $role = 'user'): User
    {
        return User::query()->create([
            'name' => 'Test User',
            'email' => $email,
            'password' => password_hash('password', PASSWORD_BCRYPT),
            'role' => $role,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('data.token');
    }
}
