<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Throwable;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            // Unmatched routes and unhandled errors render outside the
            // middleware stack; render them here so they get the headers too.
            $handler = app(ExceptionHandler::class);
            $handler->report($exception);
            $response = $handler->render($request, $exception);
        }

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('Content-Security-Policy', $this->contentSecurityPolicy($request));

        if ($request->isSecure() && config('security.enable_hsts')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Framework fingerprint: never advertise the underlying stack.
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('X-AspNet-Version');
        $response->headers->remove('X-Runtime');

        return $response;
    }

    /**
     * The JSON API gets a deny-all policy. The only HTML this app serves is the
     * Swagger UI and the welcome page, which get 'self' plus the minimal extras
     * they genuinely need (documented in the README).
     */
    private function contentSecurityPolicy(Request $request): string
    {
        if ($request->is('api/v1/docs')) {
            return "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:";
        }

        if ($request->is('api', 'api/*')) {
            return "default-src 'none'";
        }

        return "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https://fonts.bunny.net; connect-src 'self'";
    }
}
