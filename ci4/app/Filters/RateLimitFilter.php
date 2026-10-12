<?php

namespace App\Filters;

use App\Libraries\RateLimiter;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Global limit: RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS requests per client IP
 * on every route except /health and the API route index
 * (_SECURITY_SPEC.md section 2).
 *
 * Config\RateLimit disables this automatically in the testing environment
 * so suites never flake; tests that exercise it flip the flag back on.
 */
class RateLimitFilter implements FilterInterface
{
    private const EXEMPT_PATHS = ['health', 'api/v1'];

    public function before(RequestInterface $request, $arguments = null)
    {
        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $config = config('RateLimit');
        if (! $config->enabled || $config->max <= 0) {
            return null;
        }

        $path = strtolower(trim($request->getUri()->getPath(), '/'));
        if (in_array($path, self::EXEMPT_PATHS, true)) {
            return null;
        }

        $retryAfter = RateLimiter::globalHit($request->getIPAddress());
        if ($retryAfter <= 0) {
            return null;
        }

        return service('response')
            ->setStatusCode(429)
            ->setHeader('Retry-After', (string) $retryAfter)
            ->setJSON(['success' => false, 'message' => RateLimiter::GLOBAL_MESSAGE]);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
