<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_security_headers_are_set_on_json_responses(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer')
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            ->assertHeader('Content-Security-Policy', "default-src 'none'");
        $this->assertNull($response->headers->get('X-Powered-By'));
        // HSTS is off by default and the test request is not HTTPS.
        $this->assertNull($response->headers->get('Strict-Transport-Security'));
    }

    public function test_oversized_bodies_are_rejected_with_the_standard_envelope(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'a@b.com',
            'password' => str_repeat('x', 102401),
        ])->assertStatus(413)->assertJson(['success' => false]);
    }

    public function test_cors_reflects_only_allowlisted_origins(): void
    {
        $allowed = $this->getJson('/api/v1/health', ['Origin' => 'http://localhost:5173']);
        $allowed->assertOk();
        $this->assertSame('http://localhost:5173', $allowed->headers->get('Access-Control-Allow-Origin'));
        $this->assertStringContainsString('Origin', (string) $allowed->headers->get('Vary'));

        $denied = $this->getJson('/api/v1/health', ['Origin' => 'http://evil.example']);
        $denied->assertOk();
        $this->assertNull($denied->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_global_rate_limit_is_skipped_in_the_testing_environment(): void
    {
        // APP_ENV=testing must never trip the global limiter, no matter how many requests.
        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/api/v1/health')->assertOk();
        }
    }
}
