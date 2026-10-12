<?php

use App\Libraries\RateLimiter;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Failed-login lockout, per _SECURITY_SPEC.md section 1.
 *
 * @internal
 */
final class LoginRateLimitTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $namespace = 'App';

    protected function setUp(): void
    {
        parent::setUp();

        RateLimiter::resetLoginRateLimits();

        $this->db->table('users')->insert([
            'name' => 'Lock Tester',
            'email' => 'lock@example.com',
            'password' => password_hash('password', PASSWORD_BCRYPT),
            'role' => 'user',
            'created_at' => '2026-10-09 00:00:00',
            'updated_at' => '2026-10-09 00:00:00',
        ]);
    }

    protected function tearDown(): void
    {
        RateLimiter::resetLoginRateLimits();

        parent::tearDown();
    }

    public function testThreeFailuresThenLockoutOnFourthAttempt(): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $result = $this->login('lock@example.com', 'wrong-password');
            $result->assertStatus(401);

            $body = json_decode($result->getJSON(), true);
            $this->assertSame(false, $body['success']);
            $this->assertArrayNotHasKey('errors', $body);
        }

        $locked = $this->login('lock@example.com', 'wrong-password');
        $locked->assertStatus(429);

        $retryAfter = (int) $locked->response()->getHeaderLine('Retry-After');
        $this->assertGreaterThanOrEqual(1, $retryAfter);

        $body = json_decode($locked->getJSON(), true);
        $this->assertSame(
            ['success' => false, 'message' => RateLimiter::LOCK_MESSAGE],
            $body
        );
        $this->assertArrayNotHasKey('errors', $body);
    }

    public function testCorrectPasswordAlsoReturns429WhileLocked(): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->login('lock@example.com', 'wrong-password')->assertStatus(401);
        }

        $locked = $this->login('lock@example.com', 'password');
        $locked->assertStatus(429);
        $this->assertGreaterThanOrEqual(1, (int) $locked->response()->getHeaderLine('Retry-After'));

        $body = json_decode($locked->getJSON(), true);
        $this->assertSame(RateLimiter::LOCK_MESSAGE, $body['message']);
    }

    public function testUnknownEmailFailuresCountTowardTheSameCounter(): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $result = $this->login('ghost@example.com', 'wrong-password');
            $result->assertStatus(401);
            $this->assertSame(false, json_decode($result->getJSON(), true)['success']);
        }

        $locked = $this->login('ghost@example.com', 'wrong-password');
        $locked->assertStatus(429);

        $body = json_decode($locked->getJSON(), true);
        $this->assertSame(
            ['success' => false, 'message' => RateLimiter::LOCK_MESSAGE],
            $body
        );
    }

    public function testSuccessfulLoginResetsTheCounter(): void
    {
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $this->login('lock@example.com', 'wrong-password')->assertStatus(401);
        }

        $this->login('lock@example.com', 'password')->assertStatus(200);

        // The success cleared the email counter: 3 more failures are still
        // plain 401s (without the reset the second one would be a 429).
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $result = $this->login('lock@example.com', 'wrong-password');
            $result->assertStatus(401);
            $this->assertSame(false, json_decode($result->getJSON(), true)['success']);
        }

        $locked = $this->login('lock@example.com', 'wrong-password');
        $locked->assertStatus(429);
    }

    public function testLockoutIsPerEmail(): void
    {
        $this->db->table('users')->insert([
            'name' => 'Other Tester',
            'email' => 'other@example.com',
            'password' => password_hash('password', PASSWORD_BCRYPT),
            'role' => 'user',
            'created_at' => '2026-10-09 00:00:00',
            'updated_at' => '2026-10-09 00:00:00',
        ]);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->login('lock@example.com', 'wrong-password')->assertStatus(401);
        }

        $this->login('lock@example.com', 'password')->assertStatus(429);
        $this->login('other@example.com', 'password')->assertStatus(200);
    }

    public function testEmailCounterIsNormalized(): void
    {
        $this->db->table('users')->insert([
            'name' => 'Case Tester',
            'email' => 'cased@example.com',
            'password' => password_hash('password', PASSWORD_BCRYPT),
            'role' => 'user',
            'created_at' => '2026-10-09 00:00:00',
            'updated_at' => '2026-10-09 00:00:00',
        ]);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->login('CASED@Example.COM', 'wrong-password')->assertStatus(401);
        }

        // Same account, different casing: the lock applies.
        $locked = $this->login('cased@example.com', 'password');
        $locked->assertStatus(429);
        $this->assertSame(RateLimiter::LOCK_MESSAGE, json_decode($locked->getJSON(), true)['message']);
    }

    public function testLogin401MessageIsGeneric(): void
    {
        $unknownEmail = $this->login('nobody@example.com', 'wrong-password');
        $wrongPassword = $this->login('lock@example.com', 'wrong-password');

        $unknownEmail->assertStatus(401);
        $wrongPassword->assertStatus(401);

        $this->assertSame($unknownEmail->getJSON(), $wrongPassword->getJSON());
        $this->assertStringNotContainsString('password', strtolower($wrongPassword->getJSON()));
    }

    private function login(string $email, string $password)
    {
        return $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email' => $email,
            'password' => $password,
        ]);
    }
}
