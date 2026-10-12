<?php

namespace App\Support;

/**
 * Sliding-window hit store shared by the login and global rate limiters.
 * Per-process memory only; expired entries are pruned on access and the whole
 * store is swept when it grows too large so it cannot grow forever. Swap the
 * store for Redis when running multiple instances.
 */
class InMemoryRateLimiter
{
    private const SWEEP_THRESHOLD = 5000;

    /** @var array<string, array{window: float, at: list<float>}> timestamps in seconds */
    private array $hits = [];

    /**
     * Seconds (>= 1) until the key may be used again, or null when under the limit.
     */
    public function retryAfter(string $key, int $max, float $windowSeconds): ?int
    {
        $this->prune($key, $windowSeconds);
        $attempts = $this->hits[$key]['at'] ?? [];
        if ($max <= 0 || count($attempts) < $max) {
            return null;
        }

        return max(1, (int) ceil($attempts[0] + $windowSeconds - microtime(true)));
    }

    public function hit(string $key, float $windowSeconds): void
    {
        $this->prune($key, $windowSeconds);
        $this->hits[$key] ??= ['window' => $windowSeconds, 'at' => []];
        $this->hits[$key]['at'][] = microtime(true);
        $this->sweep();
    }

    public function clear(string $key): void
    {
        unset($this->hits[$key]);
    }

    public function reset(): void
    {
        $this->hits = [];
    }

    private function prune(string $key, float $windowSeconds): void
    {
        if (!isset($this->hits[$key])) {
            return;
        }

        $cutoff = microtime(true) - $windowSeconds;
        $this->hits[$key]['at'] = array_values(array_filter(
            $this->hits[$key]['at'],
            fn (float $at) => $at > $cutoff,
        ));

        if ($this->hits[$key]['at'] === []) {
            unset($this->hits[$key]);
        }
    }

    private function sweep(): void
    {
        if (count($this->hits) <= self::SWEEP_THRESHOLD) {
            return;
        }

        $now = microtime(true);
        foreach ($this->hits as $key => $entry) {
            $cutoff = $now - $entry['window'];
            $remaining = array_values(array_filter($entry['at'], fn (float $at) => $at > $cutoff));
            if ($remaining === []) {
                unset($this->hits[$key]);
            } else {
                $this->hits[$key]['at'] = $remaining;
            }
        }
    }
}
