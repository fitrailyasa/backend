<?php

namespace App\Http\Middleware;

use App\Support\InMemoryRateLimiter;
use Closure;
use Illuminate\Http\Request;

class GlobalRateLimit
{
    public function __construct(private readonly InMemoryRateLimiter $store)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        $enabled = (bool) config('security.rate_limit_enabled')
            && !app()->environment('testing');
        $max = (int) config('security.rate_limit_max');

        // Health checks and the route index are never rate limited.
        if (!$enabled || $max <= 0 || $request->is('health', 'up', 'api/v1/health', 'api/v1')) {
            return $next($request);
        }

        $windowSeconds = max(1, (int) config('security.rate_limit_window_ms')) / 1000;
        $key = 'global:' . ($request->ip() ?? 'unknown');

        $retryAfter = $this->store->retryAfter($key, $max, $windowSeconds);
        if ($retryAfter !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Too many requests, please try again later',
            ], 429)->header('Retry-After', (string) $retryAfter);
        }

        $this->store->hit($key, $windowSeconds);

        return $next($request);
    }
}
