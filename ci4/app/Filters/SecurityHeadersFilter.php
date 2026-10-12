<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Hardens every response: security headers, CSP, conditional HSTS and
 * removal of framework fingerprints (_SECURITY_SPEC.md section 3).
 *
 * The headers are applied in `before` on the shared response because
 * CodeIgniter skips the global `after` filters when a `before` filter
 * returns a response (401/429 short-circuits) and when an exception is
 * handled. The required `after` position re-applies them to the final
 * response, which also covers 404/error pages built later in the cycle.
 */
class SecurityHeadersFilter implements FilterInterface
{
    /**
     * The JSON API serves no assets.
     */
    private const API_CSP = "default-src 'none'";

    /**
     * The welcome page and the Swagger UI are the only HTML this app serves;
     * both use inline scripts/styles plus same-origin assets.
     */
    private const UI_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'";

    private const HSTS_MAX_AGE = 'max-age=15552000';

    public function before(RequestInterface $request, $arguments = null)
    {
        $this->apply($request, service('response'));

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $this->apply($request, $response);
        $this->varyOrigin($request, $response);

        return $response;
    }

    private function apply(RequestInterface $request, ResponseInterface $response): void
    {
        $response->setHeader('X-Content-Type-Options', 'nosniff');
        $response->setHeader('X-Frame-Options', 'DENY');
        $response->setHeader('Referrer-Policy', 'no-referrer');
        $response->setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        $response->setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->setHeader('Content-Security-Policy', $this->csp($request));

        if (config('Security')->enableHsts && $request instanceof IncomingRequest && $request->isSecure()) {
            $response->setHeader('Strict-Transport-Security', self::HSTS_MAX_AGE);
        }

        // Fingerprint: never expose the runtime/framework identifier.
        $response->removeHeader('X-Powered-By');
        $response->removeHeader('Server');
        $response->removeHeader('X-AspNet-Version');

        if (PHP_SAPI !== 'cli' && ! headers_sent()) {
            header_remove('X-Powered-By');
        }
    }

    private function csp(RequestInterface $request): string
    {
        $path = trim($request->getUri()->getPath(), '/');

        return ($path === '' || str_starts_with($path, 'api/v1/docs'))
            ? self::UI_CSP
            : self::API_CSP;
    }

    /**
     * Responses that vary by Origin must say so, otherwise a shared cache
     * could serve a response without CORS headers to an allowed origin.
     * Runs after the CORS filter has had its say to avoid duplicate values.
     */
    private function varyOrigin(RequestInterface $request, ResponseInterface $response): void
    {
        if ($request->getHeaderLine('Origin') === '') {
            return;
        }

        $vary = $response->getHeaderLine('Vary');
        if ($vary === '' || stripos($vary, 'origin') === false) {
            $response->appendHeader('Vary', 'Origin');
        }
    }
}
