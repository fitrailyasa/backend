<?php

use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * @internal
 */
final class ApiContractTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $namespace = 'App';

    protected function setUp(): void
    {
        parent::setUp();

        $this->db->table('users')->insert([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => password_hash('password', PASSWORD_BCRYPT),
            'role' => 'admin',
            'created_at' => '2026-10-09 00:00:00',
            'updated_at' => '2026-10-09 00:00:00',
        ]);
    }

    public function testHealthAndIndexArePublic(): void
    {
        $health = $this->get('health');
        $health->assertStatus(200);
        $health->assertJSONFragment(['status' => 'ok']);

        $index = $this->get('api/v1');
        $index->assertStatus(200);
        $index->assertJSONFragment(['success' => true]);
    }

    public function testRegisterRejectsInvalidFields(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'name' => 'A',
            'email' => 'bad',
            'password' => 'short',
            'password_confirmation' => 'nope',
        ]);

        $result->assertStatus(422);
        $errors = json_decode($result->getJSON(), true)['errors'];
        $this->assertArrayHasKey('name', $errors);
        $this->assertArrayHasKey('email', $errors);
        $this->assertArrayHasKey('password', $errors);
        $this->assertArrayHasKey('password_confirmation', $errors);
    }

    public function testLoginRejectsUnknownCredentialsAndAcceptsTheAdmin(): void
    {
        $this->withBodyFormat('json')->post('api/v1/auth/login', [])
            ->assertStatus(422);

        $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(401);

        $login = $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);
        $login->assertStatus(200);
        $login->assertJSONFragment(['message' => 'Login successful']);
        $body = json_decode($login->getJSON(), true);
        $this->assertIsString($body['data']['token']);
        $this->assertArrayNotHasKey('password', $body['data']['user']);
    }

    public function testLogoutRevokesTheAccessToken(): void
    {
        $token = $this->adminToken();

        $this->withHeaders(['Authorization' => 'Bearer ' . $token])->get('api/v1/auth/me')->assertStatus(200);
        $this->withHeaders(['Authorization' => 'Bearer ' . $token])->post('api/v1/auth/logout')->assertStatus(200);
        $this->withHeaders(['Authorization' => 'Bearer ' . $token])->get('api/v1/auth/me')->assertStatus(401);
    }

    public function testCategoryQueriesAndWritesAreValidated(): void
    {
        $listed = $this->get('api/v1/categories?page=0&limit=0&sort=nope&order=sideways&include=nope');
        $listed->assertStatus(422);
        $errors = json_decode($listed->getJSON(), true)['errors'];
        foreach (['page', 'limit', 'sort', 'order', 'include'] as $field) {
            $this->assertArrayHasKey($field, $errors);
        }

        $this->withBodyFormat('json')->post('api/v1/categories', ['name' => 'Valid Name'])->assertStatus(401);

        $token = $this->adminToken();
        $this->withHeaders(['Authorization' => 'Bearer ' . $token])
            ->withBodyFormat('json')
            ->post('api/v1/categories', ['name' => 'X', 'slug' => 'Bad Slug'])
            ->assertStatus(422);

        $created = $this->withHeaders(['Authorization' => 'Bearer ' . $token])
            ->withBodyFormat('json')
            ->post('api/v1/categories', ['name' => 'Valid Category Name']);
        $created->assertStatus(201);
        $this->assertSame('valid-category-name', json_decode($created->getJSON(), true)['data']['slug']);
    }

    private function adminToken(): string
    {
        $login = $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);
        $login->assertStatus(200);

        return json_decode($login->getJSON(), true)['data']['token'];
    }
}
