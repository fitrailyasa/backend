<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\LoginRateLimiter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private LoginRateLimiter $limiter;

    protected function setUp(): void
    {
        parent::setUp();
        $this->limiter = $this->app->make(LoginRateLimiter::class);
        $this->limiter->reset();
    }

    protected function tearDown(): void
    {
        $this->limiter->reset();
        parent::tearDown();
    }

    public function test_three_failures_return_401_and_the_fourth_is_locked(): void
    {
        $this->user('lockme@example.com');

        for ($i = 0; $i < 3; $i++) {
            $this->attempt('lockme@example.com', 'wrong-password')->assertUnauthorized();
        }

        $locked = $this->attempt('lockme@example.com', 'wrong-password');
        $locked->assertStatus(429)
            ->assertJson(['success' => false, 'message' => 'Too many failed login attempts. Please try again later.'])
            ->assertJsonMissingPath('errors');
        $this->assertGreaterThanOrEqual(1, (int) $locked->headers->get('Retry-After'));
    }

    public function test_correct_password_is_rejected_while_locked(): void
    {
        $this->user('lockme2@example.com');

        for ($i = 0; $i < 3; $i++) {
            $this->attempt('lockme2@example.com', 'wrong-password')->assertUnauthorized();
        }

        $this->attempt('lockme2@example.com', 'password')
            ->assertStatus(429)
            ->assertJson(['success' => false, 'message' => 'Too many failed login attempts. Please try again later.']);
    }

    public function test_unknown_email_failures_count_toward_the_same_counter(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->attempt('ghost@example.com', 'wrong-password')->assertUnauthorized();
        }

        $this->attempt('ghost@example.com', 'wrong-password')
            ->assertStatus(429)
            ->assertJsonMissingPath('errors');
    }

    public function test_successful_login_resets_the_counter(): void
    {
        $this->user('reset@example.com');

        $this->attempt('reset@example.com', 'wrong-password')->assertUnauthorized();
        $this->attempt('reset@example.com', 'wrong-password')->assertUnauthorized();
        $this->attempt('reset@example.com', 'password')->assertOk();

        // The counter was cleared by the success: 3 fresh failures are allowed again.
        for ($i = 0; $i < 3; $i++) {
            $this->attempt('reset@example.com', 'wrong-password')->assertUnauthorized();
        }
        $this->attempt('reset@example.com', 'wrong-password')->assertStatus(429);
    }

    public function test_lockout_is_per_email(): void
    {
        $this->user('a@example.com');
        $this->user('b@example.com', 'user', 'password');

        for ($i = 0; $i < 3; $i++) {
            $this->attempt('a@example.com', 'wrong-password')->assertUnauthorized();
        }
        $this->attempt('a@example.com', 'password')->assertStatus(429);

        // b@example.com is unaffected by a@example.com's lockout.
        $this->attempt('b@example.com', 'password')->assertOk();
    }

    public function test_lockout_key_is_normalized(): void
    {
        $this->user('mixed@example.com');

        for ($i = 0; $i < 3; $i++) {
            $this->attempt('Mixed@Example.com ', 'wrong-password')->assertUnauthorized();
        }

        // Same email with different case/whitespace must be locked too.
        $this->attempt('MIXED@example.com', 'password')->assertStatus(429);
    }

    public function test_validation_errors_do_not_count_as_attempts(): void
    {
        $this->user('valid@example.com');

        $this->postJson('/api/v1/auth/login', ['email' => 'not-an-email', 'password' => 'x'])
            ->assertStatus(422);

        // No credential check happened, so a correct login still works.
        $this->attempt('valid@example.com', 'password')->assertOk();
    }

    private function attempt(string $email, string $password)
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ]);
    }

    private function user(string $email, string $role = 'user', string $password = 'password'): User
    {
        return User::query()->create([
            'name' => 'Test User',
            'email' => $email,
            'password' => password_hash($password, PASSWORD_BCRYPT),
            'role' => $role,
        ]);
    }
}
