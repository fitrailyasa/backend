<?php

use App\Libraries\RateLimiter;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Hardening from _SECURITY_SPEC.md section 3: security headers, CORS
 * allowlist, body cap and the global rate limit.
 *
 * @internal
 */
final class SecurityHardeningTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $namespace = 'App';

    protected function setUp(): void
    {
        parent::setUp();

        RateLimiter::resetAll();

        // Feature tests share one Response instance; drop CORS headers set by
        // an earlier test so assertions see only what this request produced.
        service('response')->removeHeader('Access-Control-Allow-Origin');
    }

    protected function tearDown(): void
    {
        RateLimiter::resetAll();

        parent::tearDown();
    }

    public function testSecurityHeadersOnEveryResponse(): void
    {
        $health = $this->get('health');
        $health->assertStatus(200);
        $response = $health->response();

        $this->assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        $this->assertSame('DENY', $response->getHeaderLine('X-Frame-Options'));
        $this->assertSame('no-referrer', $response->getHeaderLine('Referrer-Policy'));
        $this->assertSame('same-origin', $response->getHeaderLine('Cross-Origin-Opener-Policy'));
        $this->assertSame('camera=(), microphone=(), geolocation=()', $response->getHeaderLine('Permissions-Policy'));
        $this->assertSame("default-src 'none'", $response->getHeaderLine('Content-Security-Policy'));
        $this->assertSame('', $response->getHeaderLine('Strict-Transport-Security'));

        // Fingerprint: no runtime/framework identifiers.
        $this->assertSame('', $response->getHeaderLine('X-Powered-By'));
        $this->assertSame('', $response->getHeaderLine('Server'));

        $api = $this->get('api/v1/categories');
        $api->assertStatus(200);
        $this->assertSame("default-src 'none'", $api->response()->getHeaderLine('Content-Security-Policy'));

        // The Swagger UI page is served from this app and needs its own CSP.
        $docs = $this->get('api/v1/docs');
        $docs->assertStatus(200);
        $this->assertStringStartsWith(
            "default-src 'self'",
            $docs->response()->getHeaderLine('Content-Security-Policy')
        );
    }

    public function testCorsAllowedOriginIsReflectedWithVaryOrigin(): void
    {
        $allowed = $this->withHeaders(['Origin' => 'http://localhost:3000'])->get('api/v1/categories');

        $allowed->assertStatus(200);
        $allowed->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        $allowed->assertHeader('Access-Control-Allow-Credentials', 'true');
        $this->assertStringContainsString('origin', strtolower($allowed->response()->getHeaderLine('Vary')));
    }

    public function testCorsDeniedOriginGetsNoAllowOriginHeader(): void
    {
        $denied = $this->withHeaders(['Origin' => 'https://evil.example.com'])->get('api/v1/categories');

        $denied->assertStatus(200);
        $denied->assertHeaderMissing('Access-Control-Allow-Origin');
        $this->assertStringContainsString('origin', strtolower($denied->response()->getHeaderLine('Vary')));
    }

    public function testPreflightIsCachedForTenMinutesMax(): void
    {
        $preflight = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
        ])->options('api/v1/categories');

        $preflight->assertStatus(204);
        $preflight->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $preflight->assertHeader('Access-Control-Max-Age', '600');
        $this->assertStringContainsString('origin', strtolower($preflight->response()->getHeaderLine('Vary')));
    }

    public function testOversizedBodyIsRejectedWithStandardEnvelope(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'name' => 'Big',
            'email' => 'big@example.com',
            'password' => str_repeat('x', 60000),
            'password_confirmation' => str_repeat('x', 60000),
        ]);

        $result->assertStatus(413);

        $body = json_decode($result->getJSON(), true);
        $this->assertSame(
            ['success' => false, 'message' => 'Request body too large'],
            $body
        );
        $this->assertArrayNotHasKey('errors', $body);
    }

    public function testGlobalRateLimitReturns429WithRetryAfter(): void
    {
        // The limiter is disabled in the testing environment, so exercise it
        // by flipping the (per-test) config for this test only.
        $config = config('RateLimit');
        $original = [$config->enabled, $config->max, $config->windowMs];
        $config->enabled = true;
        $config->max = 3;
        $config->windowMs = 60000;

        RateLimiter::resetRateLimits();

        try {
            for ($attempt = 0; $attempt < 3; $attempt++) {
                $this->get('api/v1/categories')->assertStatus(200);
            }

            $limited = $this->get('api/v1/categories');
            $limited->assertStatus(429);
            $this->assertGreaterThanOrEqual(1, (int) $limited->response()->getHeaderLine('Retry-After'));

            $body = json_decode($limited->getJSON(), true);
            $this->assertSame(
                ['success' => false, 'message' => RateLimiter::GLOBAL_MESSAGE],
                $body
            );
            $this->assertArrayNotHasKey('errors', $body);

            // /health and the route index are exempt.
            $this->get('health')->assertStatus(200);
            $this->get('api/v1')->assertStatus(200);
        } finally {
            [$config->enabled, $config->max, $config->windowMs] = $original;
            RateLimiter::resetRateLimits();
        }
    }
}
