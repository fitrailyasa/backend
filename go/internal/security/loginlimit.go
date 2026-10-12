// Package security holds cross cutting protections required by
// _SECURITY_SPEC.md, most notably the failed-login limiter.
package security

import (
	"strings"
	"sync"
	"time"
)

// LoginLimits configures the sliding-window counters used by LoginLimiter.
// A max of zero or less disables that counter.
type LoginLimits struct {
	EmailMax    int
	EmailWindow time.Duration
	IPMax       int
	IPWindow    time.Duration
}

// LoginLimiter counts failed login attempts per normalized email and per
// client IP so one account cannot be brute forced and one client cannot spray
// many accounts. Timestamps live in sliding windows: expired entries are
// dropped whenever a key is touched and both stores are swept periodically so
// they cannot grow without bound. It is safe for concurrent use.
type LoginLimiter struct {
	limits    LoginLimits
	lastSweep time.Time

	mu     sync.Mutex
	emails map[string][]int64
	ips    map[string][]int64
}

const (
	// sweepThreshold forces a full sweep once either store grows past this
	// many keys, no matter when the last sweep ran.
	sweepThreshold = 5000
	// sweepInterval drops expired keys even when both stores stay small.
	sweepInterval = 5 * time.Minute
)

// NewLoginLimiter returns a limiter with fresh counters.
func NewLoginLimiter(limits LoginLimits) *LoginLimiter {
	return &LoginLimiter{
		limits:    limits,
		lastSweep: time.Now(),
		emails:    map[string][]int64{},
		ips:       map[string][]int64{},
	}
}

// NormalizeEmail trims and lowercases an address so " Admin@X.com " shares a
// counter with "admin@x.com".
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Check reports whether the next login attempt must be rejected with HTTP 429
// before any password work happens. The returned wait is the time until the
// blocking window drops below its limit; RetryAfterSeconds turns it into a
// Retry-After header value.
func (l *LoginLimiter) Check(email, ip string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	l.sweep(now)
	wait := time.Duration(0)
	limited := false
	if l.limits.EmailMax > 0 {
		window := l.prune(l.emails, NormalizeEmail(email), now, l.limits.EmailWindow)
		if len(window) >= l.limits.EmailMax {
			limited = true
			wait = max(wait, unlockWait(window, l.limits.EmailMax, now, l.limits.EmailWindow))
		}
	}
	if l.limits.IPMax > 0 {
		window := l.prune(l.ips, ip, now, l.limits.IPWindow)
		if len(window) >= l.limits.IPMax {
			limited = true
			wait = max(wait, unlockWait(window, l.limits.IPMax, now, l.limits.IPWindow))
		}
	}
	return wait, limited
}

// RecordFailure stores one failed credential check for the email and the IP.
func (l *LoginLimiter) RecordFailure(email, ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	l.sweep(now)
	if l.limits.EmailMax > 0 {
		key := NormalizeEmail(email)
		l.prune(l.emails, key, now, l.limits.EmailWindow)
		l.emails[key] = append(l.emails[key], now.UnixMilli())
	}
	if l.limits.IPMax > 0 {
		l.prune(l.ips, ip, now, l.limits.IPWindow)
		l.ips[ip] = append(l.ips[ip], now.UnixMilli())
	}
}

// ResetEmail drops the counter for one email after a successful login.
func (l *LoginLimiter) ResetEmail(email string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.emails, NormalizeEmail(email))
}

// Reset drops every counter; test setups call it between cases so suites
// stay deterministic.
func (l *LoginLimiter) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	clear(l.emails)
	clear(l.ips)
}

// RetryAfterSeconds converts a wait into the Retry-After header value: whole
// seconds rounded up, never less than 1.
func RetryAfterSeconds(wait time.Duration) int64 {
	seconds := int64(wait / time.Second)
	if wait%time.Second != 0 {
		seconds++
	}
	if seconds < 1 {
		seconds = 1
	}
	return seconds
}

// prune removes expired timestamps for key, deleting the key once its window
// is empty, and returns the surviving timestamps in ascending order.
// The caller must hold the mutex.
func (l *LoginLimiter) prune(store map[string][]int64, key string, now time.Time, window time.Duration) []int64 {
	timestamps := store[key]
	if len(timestamps) == 0 {
		delete(store, key)
		return nil
	}
	cutoff := now.Add(-window).UnixMilli()
	kept := timestamps[:0]
	for _, ts := range timestamps {
		if ts > cutoff {
			kept = append(kept, ts)
		}
	}
	if len(kept) == 0 {
		delete(store, key)
		return nil
	}
	store[key] = kept
	return kept
}

// unlockWait returns how long until the window drops below limit. The
// (len-limit+1)-th oldest failure is the one whose expiry unlocks the key.
func unlockWait(window []int64, limit int, now time.Time, windowLength time.Duration) time.Duration {
	if limit <= 0 || len(window) < limit {
		return 0
	}
	expiresAt := time.UnixMilli(window[len(window)-limit]).Add(windowLength)
	wait := expiresAt.Sub(now)
	if wait < 0 {
		return 0
	}
	return wait
}

// sweep drops expired keys when a store grows large or when the sweep
// interval has elapsed. The caller must hold the mutex.
func (l *LoginLimiter) sweep(now time.Time) {
	oversized := len(l.emails) >= sweepThreshold || len(l.ips) >= sweepThreshold
	if !oversized && now.Sub(l.lastSweep) < sweepInterval {
		return
	}
	l.lastSweep = now
	for key := range l.emails {
		l.prune(l.emails, key, now, l.limits.EmailWindow)
	}
	for key := range l.ips {
		l.prune(l.ips, key, now, l.limits.IPWindow)
	}
}
