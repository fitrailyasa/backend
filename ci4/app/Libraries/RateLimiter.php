<?php

namespace App\Libraries;

use CodeIgniter\Cache\CacheInterface;
use Config\RateLimit;

/**
 * Sliding-window counters for failed login attempts and global request
 * volume (_SECURITY_SPEC.md sections 1 and 2).
 *
 * The counters live in the framework cache service (file handler by default,
 * under `writable/cache`) rather than in PHP statics: PHP discards class
 * statics at the end of every request, so a memory-only counter would start
 * each HTTP request empty and could never lock anyone out. The cache handler
 * is the only store, so pointing `Config\Cache` at Redis (or any other
 * handler) shares the counters between workers, instances or hosts without
 * touching this class.
 *
 * Every public entry point runs inside an exclusive lock file, because the
 * store is read-modify-written: without it, parallel brute-force requests
 * handled by different PHP workers could each read the same counter and drop
 * each other's failures. The lock is held only for one small read + write.
 *
 * The store prunes itself: expired timestamps and emptied keys are dropped on
 * every operation, each blob carries a TTL equal to its window so an untouched
 * store expires on its own, a blob past MAX_STORE_KEYS live keys drops its
 * least recently failing keys, and a single key never keeps more than its own
 * limit of timestamps inside the window.
 */
class RateLimiter
{
    /**
     * Message returned with the 429 when a login is locked.
     */
    public const LOCK_MESSAGE = 'Too many failed login attempts. Please try again later.';

    /**
     * Message returned with the 429 when the global limiter trips.
     */
    public const GLOBAL_MESSAGE = 'Too many requests, please try again later';

    /**
     * Cache key holding every failed-login counter (email and IP).
     *
     * @internal public only so tests can assert the state survives the request
     */
    public const LOGIN_STORE = 'security_ratelimit_login';

    /**
     * Cache key holding the global per-IP request counters.
     *
     * @internal
     */
    public const GLOBAL_STORE = 'security_ratelimit_global';

    /**
     * Drop the least recently failing keys once a blob tracks more than this.
     */
    private const MAX_STORE_KEYS = 1000;

    /**
     * Floor for the per-key timestamp cap: a key never keeps more than
     * max(this, its configured maximum) timestamps inside the window, so one
     * hot key cannot grow its list without bound.
     */
    private const MIN_STAMP_LIMIT = 100;

    /**
     * Trim + lowercase so `Admin@X.com` cannot bypass the per-email limit.
     */
    public static function normalizeEmail(mixed $email): string
    {
        return is_string($email) ? strtolower(trim($email)) : '';
    }

    // ------------------------------------------------------------------
    // Login attempt limiter
    // ------------------------------------------------------------------

    /**
     * Seconds until the oldest failure in a triggering window expires
     * (always >= 1), or 0 when neither the email nor the IP counter is
     * exhausted. Call this before verifying any password.
     */
    public static function loginRetryAfter(string $email, string $ip): int
    {
        return self::withLock(static fn (): int => self::loginRetryAfterLocked($email, $ip));
    }

    /**
     * Record one failed credential check for the email and the client IP.
     */
    public static function recordLoginFailure(string $email, string $ip): void
    {
        self::withLock(static function () use ($email, $ip): void {
            $config = config('RateLimit');
            $now    = microtime(true) * 1000;

            $store = self::pruneLogin(self::readStore(self::LOGIN_STORE), $config, $now);

            $emailKey = self::normalizeEmail($email);
            if ($emailKey !== '') {
                $store['email'][$emailKey] = self::push(
                    $store['email'][$emailKey] ?? [],
                    $now,
                    max(self::MIN_STAMP_LIMIT, $config->loginEmailMax)
                );
            }
            if ($ip !== '') {
                $store['ip'][$ip] = self::push(
                    $store['ip'][$ip] ?? [],
                    $now,
                    max(self::MIN_STAMP_LIMIT, $config->loginIpMax)
                );
            }

            $store['email'] = self::sweep($store['email']);
            $store['ip']    = self::sweep($store['ip']);

            self::saveStore(self::LOGIN_STORE, $store, self::loginTtl($config));
        });
    }

    /**
     * A successful login clears that email's counter.
     */
    public static function clearLoginFailures(string $email): void
    {
        self::withLock(static function () use ($email): void {
            $emailKey = self::normalizeEmail($email);
            if ($emailKey === '') {
                return;
            }

            $store = self::readStore(self::LOGIN_STORE);
            if (! isset($store['email'][$emailKey])) {
                return;
            }

            unset($store['email'][$emailKey]);

            self::saveStore(self::LOGIN_STORE, $store, self::loginTtl(config('RateLimit')));
        });
    }

    /**
     * Test hook: drop every failed-login counter.
     */
    public static function resetLoginRateLimits(): void
    {
        self::withLock(static function (): void {
            self::cache()->delete(self::LOGIN_STORE);
        });
    }

    // ------------------------------------------------------------------
    // Global request limiter
    // ------------------------------------------------------------------

    /**
     * Register one request for the IP. Returns the Retry-After seconds when
     * the IP is already over the limit, 0 when the request is allowed.
     */
    public static function globalHit(string $ip): int
    {
        return self::withLock(static function () use ($ip): int {
            $config = config('RateLimit');
            if ($config->max <= 0) {
                return 0;
            }

            $now   = microtime(true) * 1000;
            $key   = $ip !== '' ? $ip : 'unknown';
            $limit = max(self::MIN_STAMP_LIMIT, $config->max);

            $store  = self::sweep(self::pruneMap(self::readStore(self::GLOBAL_STORE), $config->windowMs, $limit, $now));
            $stamps = $store[$key] ?? [];

            if (count($stamps) >= $config->max) {
                self::saveStore(self::GLOBAL_STORE, $store, self::windowTtl($config));

                return max(1, (int) ceil((min($stamps) + $config->windowMs - $now) / 1000));
            }

            $store[$key] = self::push($stamps, $now, $limit);
            self::saveStore(self::GLOBAL_STORE, $store, self::windowTtl($config));

            return 0;
        });
    }

    /**
     * Test hook: drop the global request counters.
     */
    public static function resetRateLimits(): void
    {
        self::withLock(static function (): void {
            self::cache()->delete(self::GLOBAL_STORE);
        });
    }

    /**
     * Test hook: drop every store.
     */
    public static function resetAll(): void
    {
        // One lock for both deletes: the two public resets must not nest.
        self::withLock(static function (): void {
            self::cache()->delete(self::LOGIN_STORE);
            self::cache()->delete(self::GLOBAL_STORE);
        });
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /**
     * Run $fn with the counter store exclusively locked. If the lock file
     * cannot be opened the operation still runs unlocked: losing atomicity
     * under parallel requests beats silently disabling the limiter.
     *
     * @template T
     * @param callable(): T $fn
     * @return T
     */
    private static function withLock(callable $fn): mixed
    {
        $handle = @fopen(WRITEPATH . 'cache/security_ratelimit.lock', 'c');

        if ($handle === false) {
            return $fn();
        }

        try {
            if (! flock($handle, LOCK_EX)) {
                return $fn();
            }

            try {
                return $fn();
            } finally {
                flock($handle, LOCK_UN);
            }
        } finally {
            fclose($handle);
        }
    }

    private static function loginRetryAfterLocked(string $email, string $ip): int
    {
        $config = config('RateLimit');
        $now    = microtime(true) * 1000;

        $store  = self::readStore(self::LOGIN_STORE);
        $pruned = self::pruneLogin($store, $config, $now);
        if ($store !== [] && $pruned !== $store) {
            self::saveStore(self::LOGIN_STORE, $pruned, self::loginTtl($config));
        }

        $emailKey = self::normalizeEmail($email);

        return max(
            $emailKey === ''
                ? 0
                : self::lockedFor($pruned['email'][$emailKey] ?? [], $config->loginEmailMax, $config->loginEmailWindowMs, $now),
            $ip === ''
                ? 0
                : self::lockedFor($pruned['ip'][$ip] ?? [], $config->loginIpMax, $config->loginIpWindowMs, $now),
        );
    }

    private static function cache(): CacheInterface
    {
        return service('cache');
    }

    /**
     * @return array<string, mixed>
     */
    private static function readStore(string $key): array
    {
        $data = self::cache()->get($key);

        return is_array($data) ? $data : [];
    }

    /**
     * @param array<string, mixed> $data
     */
    private static function saveStore(string $key, array $data, int $ttlSeconds): void
    {
        self::cache()->save($key, $data, $ttlSeconds);
    }

    /**
     * Normalize the login blob shape and drop everything outside its windows.
     *
     * @param array<string, mixed> $store
     * @return array{email: array<string, list<float>>, ip: array<string, list<float>>}
     */
    private static function pruneLogin(array $store, RateLimit $config, float $now): array
    {
        return [
            'email' => self::sweep(self::pruneMap(
                is_array($store['email'] ?? null) ? $store['email'] : [],
                $config->loginEmailWindowMs,
                max(self::MIN_STAMP_LIMIT, $config->loginEmailMax),
                $now
            )),
            'ip' => self::sweep(self::pruneMap(
                is_array($store['ip'] ?? null) ? $store['ip'] : [],
                $config->loginIpWindowMs,
                max(self::MIN_STAMP_LIMIT, $config->loginIpMax),
                $now
            )),
        ];
    }

    /**
     * Keep only unexpired timestamps per key, drop empty keys and cap the
     * number of timestamps a single key may keep.
     *
     * @param array<string, mixed> $map
     * @return array<string, list<float>>
     */
    private static function pruneMap(array $map, int $windowMs, int $limit, float $now): array
    {
        $pruned = [];

        foreach ($map as $key => $stamps) {
            if (! is_array($stamps)) {
                continue;
            }

            $live = [];
            foreach ($stamps as $stamp) {
                if ((is_float($stamp) || is_int($stamp)) && $stamp + $windowMs > $now) {
                    $live[] = (float) $stamp;
                }
            }

            if ($live !== []) {
                $pruned[(string) $key] = array_slice($live, -$limit);
            }
        }

        return $pruned;
    }

    /**
     * Bounded growth: once a blob tracks more than MAX_STORE_KEYS live keys,
     * the keys whose newest timestamp is oldest are dropped.
     *
     * @param array<string, list<float>> $map
     * @return array<string, list<float>>
     */
    private static function sweep(array $map): array
    {
        if (count($map) <= self::MAX_STORE_KEYS) {
            return $map;
        }

        uasort($map, static fn (array $a, array $b): int => max($b) <=> max($a));

        return array_slice($map, 0, self::MAX_STORE_KEYS, true);
    }

    /**
     * Append a timestamp, keeping the newest $limit entries.
     *
     * @param list<float>|null $stamps
     * @return list<float>
     */
    private static function push(?array $stamps, float $now, int $limit): array
    {
        $stamps   = $stamps ?? [];
        $stamps[] = $now;

        return count($stamps) > $limit ? array_slice($stamps, -$limit) : $stamps;
    }

    /**
     * @param list<float> $stamps
     */
    private static function lockedFor(array $stamps, int $max, int $windowMs, float $now): int
    {
        if ($max <= 0 || count($stamps) < $max) {
            return 0;
        }

        return max(1, (int) ceil((min($stamps) + $windowMs - $now) / 1000));
    }

    private static function loginTtl(RateLimit $config): int
    {
        return self::toSeconds(max($config->loginEmailWindowMs, $config->loginIpWindowMs));
    }

    private static function windowTtl(RateLimit $config): int
    {
        return self::toSeconds($config->windowMs);
    }

    /**
     * TTL is never shorter than the window, so a blob can never expire while
     * a timestamp inside it is still counting.
     */
    private static function toSeconds(int $windowMs): int
    {
        return max(1, (int) ceil($windowMs / 1000));
    }
}
