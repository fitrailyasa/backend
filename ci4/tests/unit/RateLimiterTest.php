<?php

use App\Libraries\RateLimiter;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * The in-memory limiter stores (_SECURITY_SPEC.md sections 1 and 2),
 * exercised directly because the global limiter is off in test runs.
 *
 * @internal
 */
final class RateLimiterTest extends CIUnitTestCase
{
    /**
     * @var array<string, int|bool>
     */
    private array $original = [];

    protected function setUp(): void
    {
        parent::setUp();

        $config = config('RateLimit');
        $this->original = [
            'loginEmailMax' => $config->loginEmailMax,
            'loginEmailWindowMs' => $config->loginEmailWindowMs,
            'loginIpMax' => $config->loginIpMax,
            'loginIpWindowMs' => $config->loginIpWindowMs,
            'max' => $config->max,
            'windowMs' => $config->windowMs,
        ];

        RateLimiter::resetAll();
    }

    protected function tearDown(): void
    {
        $config = config('RateLimit');
        foreach ($this->original as $key => $value) {
            $config->$key = $value;
        }
        RateLimiter::resetAll();

        parent::tearDown();
    }

    public function testLocksAfterConfiguredNumberOfEmailFailures(): void
    {
        $config = config('RateLimit');
        $config->loginEmailMax = 3;

        $this->assertSame(0, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));

        RateLimiter::recordLoginFailure('a@x.com', '1.1.1.1');
        RateLimiter::recordLoginFailure('a@x.com', '1.1.1.1');
        $this->assertSame(0, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));

        RateLimiter::recordLoginFailure('a@x.com', '1.1.1.1');
        $this->assertGreaterThanOrEqual(1, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));

        // Lockout is per email.
        $this->assertSame(0, RateLimiter::loginRetryAfter('b@x.com', '2.2.2.2'));

        // A successful login clears that email's counter.
        RateLimiter::clearLoginFailures('a@x.com');
        $this->assertSame(0, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));
    }

    public function testEmailKeyIsNormalized(): void
    {
        $config = config('RateLimit');
        $config->loginEmailMax = 2;

        RateLimiter::recordLoginFailure('  Admin@X.com ', '1.1.1.1');
        RateLimiter::recordLoginFailure('admin@x.com', '1.1.1.1');

        $this->assertGreaterThanOrEqual(1, RateLimiter::loginRetryAfter('ADMIN@X.COM', '9.9.9.9'));
    }

    public function testIpCounterLocksIndependentlyOfEmail(): void
    {
        $config = config('RateLimit');
        $config->loginIpMax = 2;

        RateLimiter::recordLoginFailure('x@x.com', '9.9.9.9');
        RateLimiter::recordLoginFailure('y@x.com', '9.9.9.9');

        $this->assertGreaterThanOrEqual(1, RateLimiter::loginRetryAfter('fresh@x.com', '9.9.9.9'));
        $this->assertSame(0, RateLimiter::loginRetryAfter('fresh@x.com', '8.8.8.8'));
    }

    public function testSlidingWindowReleasesTheLockWhenTheOldestFailureExpires(): void
    {
        $config = config('RateLimit');
        $config->loginEmailMax = 1;
        $config->loginEmailWindowMs = 1;

        RateLimiter::recordLoginFailure('a@x.com', '1.1.1.1');
        $this->assertGreaterThanOrEqual(1, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));

        usleep(5000);
        $this->assertSame(0, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));
    }

    public function testGlobalLimiterCountsPerIp(): void
    {
        $config = config('RateLimit');
        $config->max = 2;
        $config->windowMs = 60000;

        $this->assertSame(0, RateLimiter::globalHit('1.2.3.4'));
        $this->assertSame(0, RateLimiter::globalHit('1.2.3.4'));
        $this->assertGreaterThanOrEqual(1, RateLimiter::globalHit('1.2.3.4'));

        // Per IP: another client is unaffected.
        $this->assertSame(0, RateLimiter::globalHit('5.6.7.8'));

        // The window slides: expired requests stop counting.
        $config->windowMs = 1;
        usleep(5000);
        $this->assertSame(0, RateLimiter::globalHit('1.2.3.4'));
    }

    public function testResetHooksClearEveryStore(): void
    {
        $config = config('RateLimit');
        $config->loginEmailMax = 1;
        $config->max = 1;

        RateLimiter::recordLoginFailure('a@x.com', '1.1.1.1');
        RateLimiter::globalHit('1.2.3.4');
        $this->assertGreaterThanOrEqual(1, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));
        $this->assertGreaterThanOrEqual(1, RateLimiter::globalHit('1.2.3.4'));

        RateLimiter::resetAll();

        $this->assertSame(0, RateLimiter::loginRetryAfter('a@x.com', '1.1.1.1'));
        $this->assertSame(0, RateLimiter::globalHit('1.2.3.4'));
    }
}
