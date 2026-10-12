<?php

namespace Config;

use CodeIgniter\Config\Filters as BaseFilters;
use CodeIgniter\Filters\Cors;
use CodeIgniter\Filters\CSRF;
use CodeIgniter\Filters\DebugToolbar;
use CodeIgniter\Filters\ForceHTTPS;
use CodeIgniter\Filters\Honeypot;
use CodeIgniter\Filters\InvalidChars;
use CodeIgniter\Filters\PageCache;
use CodeIgniter\Filters\PerformanceMetrics;
use CodeIgniter\Filters\SecureHeaders;
use App\Filters\ApiAuthFilter;
use App\Filters\ApiAdminFilter;
use App\Filters\BodyLimitFilter;
use App\Filters\LoginRateLimitFilter;
use App\Filters\NormalizeJsonFilter;
use App\Filters\RateLimitFilter;
use App\Filters\SecurityHeadersFilter;

class Filters extends BaseFilters
{
    /**
     * Configures aliases for Filter classes to
     * make reading things nicer and simpler.
     *
     * @var array<string, class-string|list<class-string>>
     *
     * [filter_name => classname]
     * or [filter_name => [classname1, classname2, ...]]
     */
    public array $aliases = [
        'csrf'            => CSRF::class,
        'toolbar'         => DebugToolbar::class,
        'honeypot'        => Honeypot::class,
        'invalidchars'    => InvalidChars::class,
        'secureheaders'   => SecureHeaders::class,
        'cors'            => Cors::class,
        'forcehttps'      => ForceHTTPS::class,
        'pagecache'       => PageCache::class,
        'performance'     => PerformanceMetrics::class,
        'api-auth'        => ApiAuthFilter::class,
        'api-admin'       => ApiAdminFilter::class,
        'normalize-json'  => NormalizeJsonFilter::class,
        'securityheaders' => SecurityHeadersFilter::class,
        'ratelimit'       => RateLimitFilter::class,
        'loginratelimit'  => LoginRateLimitFilter::class,
        'bodylimit'       => BodyLimitFilter::class,
    ];

    /**
     * List of special required filters.
     *
     * The filters listed here are special. They are applied before and after
     * other kinds of filters, and always applied even if a route does not exist.
     *
     * Filters set by default provide framework functionality. If removed,
     * those functions will no longer work.
     *
     * @see https://codeigniter.com/user_guide/incoming/filters.html#provided-filters
     *
     * @var array{before: list<string>, after: list<string>}
     */
    public array $required = [
        'before' => [
            'forcehttps', // Force Global Secure Requests
            'pagecache',  // Web Page Caching
            // CORS must run before routing: an OPTIONS preflight has no route,
            // so a global before-filter would never see it (PageNotFoundException).
            'cors',
        ],
        'after' => [
            'pagecache',   // Web Page Caching
            'performance', // Performance Metrics
            'securityheaders', // Security headers on every response, even the ones short-circuited by a before filter
        ],
    ];

    /**
     * List of filter aliases that are always
     * applied before and after every request.
     *
     * @var array{
     *     before: array<string, array{except: list<string>|string}>|list<string>,
     *     after: array<string, array{except: list<string>|string}>|list<string>
     * }
     */
    public array $globals = [
        'before' => [
            // Security headers first so every response carries them, even
            // when a later filter short-circuits with a 401/429.
            'securityheaders',
            'ratelimit',
            'bodylimit',
            // 'honeypot',
            // 'csrf',
            // 'invalidchars',
        ],
        'after' => [
            'normalize-json',
            'toolbar' => ['except' => ['api/v1/docs', 'api/v1/docs/*', 'swagger-ui/*']],
        ],
    ];

    /**
     * List of filter aliases that works on a
     * particular HTTP method (GET, POST, etc.).
     *
     * Example:
     * 'POST' => ['foo', 'bar']
     *
     * If you use this, you should disable auto-routing because auto-routing
     * permits any HTTP method to access a controller. Accessing the controller
     * with a method you don't expect could bypass the filter.
     *
     * @var array<string, list<string>>
     */
    public array $methods = [];

    /**
     * List of filter aliases that should run on any
     * before or after URI patterns.
     *
     * Example:
     * 'isLoggedIn' => ['before' => ['account/*', 'profiles/*']]
     *
     * @var array<string, array<string, list<string>>>
     */
    public array $filters = [];
}
