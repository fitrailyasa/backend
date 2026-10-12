<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Login Attempt Limiter
    |--------------------------------------------------------------------------
    |
    | Failed credential checks (unknown email and wrong password) are counted
    | per normalized email and per client IP over a sliding window. A
    | successful login clears that email's counter.
    |
    */

    'login_rate_limit_max' => (int) env('LOGIN_RATE_LIMIT_MAX', 3),
    'login_rate_limit_window_ms' => (int) env('LOGIN_RATE_LIMIT_WINDOW_MS', 900000),
    'login_ip_rate_limit_max' => (int) env('LOGIN_IP_RATE_LIMIT_MAX', 10),
    'login_ip_rate_limit_window_ms' => (int) env('LOGIN_IP_RATE_LIMIT_WINDOW_MS', 900000),

    /*
    |--------------------------------------------------------------------------
    | Global Request Rate Limit
    |--------------------------------------------------------------------------
    |
    | Requests per client IP over a sliding window, applied to every route
    | except the health checks and the route index. Automatically skipped
    | when APP_ENV=testing so test suites never flake.
    |
    */

    'rate_limit_enabled' => env('RATE_LIMIT_ENABLED', true),
    'rate_limit_max' => (int) env('RATE_LIMIT_MAX', 300),
    'rate_limit_window_ms' => (int) env('RATE_LIMIT_WINDOW_MS', 60000),

    /*
    |--------------------------------------------------------------------------
    | Request Body Size Cap
    |--------------------------------------------------------------------------
    */

    'body_limit' => (int) env('BODY_LIMIT', 102400),

    /*
    |--------------------------------------------------------------------------
    | Strict Transport Security
    |--------------------------------------------------------------------------
    |
    | Emit HSTS only for HTTPS requests, and only when explicitly enabled.
    |
    */

    'enable_hsts' => (bool) env('ENABLE_HSTS', false),

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | When enabled, X-Forwarded-For is trusted so rate limits see the real
    | client IP. Leave disabled unless behind a reverse proxy you control.
    |
    */

    'trust_proxy' => (bool) env('TRUST_PROXY', false),

];
