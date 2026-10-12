<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Rate limit and request size settings (see _SECURITY_SPEC.md).
 *
 * Every value can be overridden from the environment; see `.env.example`.
 */
class RateLimit extends BaseConfig
{
    /**
     * Failed logins allowed per normalized email before lockout.
     */
    public int $loginEmailMax = 3;

    /**
     * Sliding window for the per-email counter (15 minutes).
     */
    public int $loginEmailWindowMs = 900000;

    /**
     * Failed logins allowed per client IP before lockout.
     */
    public int $loginIpMax = 10;

    /**
     * Sliding window for the per-IP counter (15 minutes).
     */
    public int $loginIpWindowMs = 900000;

    /**
     * Requests allowed per client IP inside $windowMs (global limiter).
     */
    public int $max = 300;

    /**
     * Window for the global limiter (60 seconds).
     */
    public int $windowMs = 60000;

    /**
     * Master switch for the global limiter.
     */
    public bool $enabled = true;

    /**
     * Maximum request body size in bytes (100kb).
     */
    public int $bodyLimit = 102400;

    public function __construct()
    {
        parent::__construct();

        $this->loginEmailMax       = (int) env('LOGIN_RATE_LIMIT_MAX', $this->loginEmailMax);
        $this->loginEmailWindowMs  = (int) env('LOGIN_RATE_LIMIT_WINDOW_MS', $this->loginEmailWindowMs);
        $this->loginIpMax          = (int) env('LOGIN_IP_RATE_LIMIT_MAX', $this->loginIpMax);
        $this->loginIpWindowMs     = (int) env('LOGIN_IP_RATE_LIMIT_WINDOW_MS', $this->loginIpWindowMs);
        $this->max                 = (int) env('RATE_LIMIT_MAX', $this->max);
        $this->windowMs            = (int) env('RATE_LIMIT_WINDOW_MS', $this->windowMs);
        $this->bodyLimit           = (int) env('BODY_LIMIT', $this->bodyLimit);
        $this->enabled             = filter_var(env('RATE_LIMIT_ENABLED', $this->enabled), FILTER_VALIDATE_BOOLEAN);

        // The global limiter must never make a suite flake: it is off in the
        // testing environment no matter what RATE_LIMIT_ENABLED says. Tests
        // that exercise it flip this flag back on for a single test.
        if (ENVIRONMENT === 'testing') {
            $this->enabled = false;
        }
    }
}
