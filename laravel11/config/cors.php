<?php

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,http://localhost:4200')),
)));

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Only the origins listed in CORS_ORIGINS are reflected; never combine a
    | wildcard origin with credentials. Vary: Origin is added by the framework
    | and preflight results are cached for at most 600 seconds.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],

    'exposed_headers' => ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],

    'max_age' => 600,

    'supports_credentials' => false,

];
