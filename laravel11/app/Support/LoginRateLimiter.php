<?php

namespace App\Support;

/**
 * Failed-login limiter: sliding window per normalized email and per client IP.
 * Counts failed credential checks only; a successful login clears the email's
 * counter. Backed by in-process memory (see InMemoryRateLimiter for the
 * pruning strategy) — swap the store for Redis when scaling out.
 */
class LoginRateLimiter
{
    public function __construct(private readonly InMemoryRateLimiter $store)
    {
    }

    /**
     * Seconds (>= 1) until the next attempt is allowed, or null when not locked.
     * The lock is checked before any password verification happens.
     */
    public function retryAfter(string $email, string $ip): ?int
    {
        $emailRetry = $this->store->retryAfter(
            $this->emailKey($email),
            (int) config('security.login_rate_limit_max'),
            self::emailWindowSeconds(),
        );
        $ipRetry = $this->store->retryAfter(
            $this->ipKey($ip),
            (int) config('security.login_ip_rate_limit_max'),
            self::ipWindowSeconds(),
        );

        if ($emailRetry === null && $ipRetry === null) {
            return null;
        }

        return max($emailRetry ?? 0, $ipRetry ?? 0, 1);
    }

    /**
     * Record one failed credential check for the email and the client IP.
     */
    public function recordFailure(string $email, string $ip): void
    {
        $this->store->hit($this->emailKey($email), self::emailWindowSeconds());
        $this->store->hit($this->ipKey($ip), self::ipWindowSeconds());
    }

    /**
     * Successful login: clear the email's failure counter.
     */
    public function clearEmail(string $email): void
    {
        $this->store->clear($this->emailKey($email));
    }

    /**
     * Reset hook for tests.
     */
    public function reset(): void
    {
        $this->store->reset();
    }

    public static function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function emailKey(string $email): string
    {
        return 'login:email:' . self::normalizeEmail($email);
    }

    private function ipKey(string $ip): string
    {
        return 'login:ip:' . $ip;
    }

    private static function emailWindowSeconds(): float
    {
        return max(1, (int) config('security.login_rate_limit_window_ms')) / 1000;
    }

    private static function ipWindowSeconds(): float
    {
        return max(1, (int) config('security.login_ip_rate_limit_window_ms')) / 1000;
    }
}
