package security

import (
	"testing"
	"time"
)

func TestLockAfterMaxFailures(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{EmailMax: 3, EmailWindow: time.Hour, IPMax: 10, IPWindow: time.Hour})
	for i := 1; i <= 2; i++ {
		l.RecordFailure("a@x.com", "1.2.3.4")
		if wait, limited := l.Check("a@x.com", "1.2.3.4"); limited {
			t.Fatalf("locked after %d failures (wait %s)", i, wait)
		}
	}
	l.RecordFailure("a@x.com", "1.2.3.4")
	wait, limited := l.Check("a@x.com", "1.2.3.4")
	if !limited {
		t.Fatal("expected lock after 3 failures")
	}
	if wait <= 0 || wait > time.Hour {
		t.Fatalf("unlock wait %s outside (0, 1h]", wait)
	}
	if seconds := RetryAfterSeconds(wait); seconds < 1 || seconds > 3600 {
		t.Fatalf("Retry-After seconds %d must be >= 1", seconds)
	}
}

func TestEmailNormalizationSharesCounter(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{EmailMax: 1, EmailWindow: time.Hour})
	l.RecordFailure("  Admin@X.COM ", "1.2.3.4")
	if _, limited := l.Check("admin@x.com", "1.2.3.4"); !limited {
		t.Fatal("casing/whitespace let the counter be bypassed")
	}
}

func TestIPCounterSpansEmails(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{EmailMax: 3, EmailWindow: time.Hour, IPMax: 2, IPWindow: time.Hour})
	l.RecordFailure("a@x.com", "1.2.3.4")
	l.RecordFailure("b@x.com", "1.2.3.4")
	if _, limited := l.Check("c@x.com", "1.2.3.4"); !limited {
		t.Fatal("IP counter should lock across different emails")
	}
	if _, limited := l.Check("c@x.com", "5.6.7.8"); limited {
		t.Fatal("another client IP was locked by this one")
	}
}

func TestSlidingWindowExpires(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{EmailMax: 1, EmailWindow: 100 * time.Millisecond})
	l.RecordFailure("a@x.com", "1.2.3.4")
	if _, limited := l.Check("a@x.com", "1.2.3.4"); !limited {
		t.Fatal("expected lock immediately after the failure")
	}
	time.Sleep(150 * time.Millisecond)
	if _, limited := l.Check("a@x.com", "1.2.3.4"); limited {
		t.Fatal("sliding window did not release the lock")
	}
}

func TestResetHooks(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{EmailMax: 1, EmailWindow: time.Hour, IPMax: 1, IPWindow: time.Hour})

	l.RecordFailure("a@x.com", "1.2.3.4")
	l.Reset()
	if _, limited := l.Check("a@x.com", "1.2.3.4"); limited {
		t.Fatal("Reset did not clear the counters")
	}

	// ResetEmail clears only the email counter; with the IP counter disabled
	// the key is fully released after a successful login.
	emailOnly := NewLoginLimiter(LoginLimits{EmailMax: 1, EmailWindow: time.Hour})
	emailOnly.RecordFailure("a@x.com", "1.2.3.4")
	emailOnly.ResetEmail("A@x.com")
	if _, limited := emailOnly.Check("a@x.com", "1.2.3.4"); limited {
		t.Fatal("ResetEmail did not clear the email counter")
	}
}

func TestDisabledWhenMaxZero(t *testing.T) {
	l := NewLoginLimiter(LoginLimits{})
	for i := 0; i < 100; i++ {
		l.RecordFailure("a@x.com", "1.2.3.4")
	}
	if _, limited := l.Check("a@x.com", "1.2.3.4"); limited {
		t.Fatal("limiter must fail open when every max is 0")
	}
}

func TestRetryAfterSeconds(t *testing.T) {
	cases := map[time.Duration]int64{
		0:                       1,
		900 * time.Millisecond:  1,
		time.Second:             1,
		1500 * time.Millisecond: 2,
	}
	for wait, want := range cases {
		if got := RetryAfterSeconds(wait); got != want {
			t.Fatalf("RetryAfterSeconds(%s) = %d, want %d", wait, got, want)
		}
	}
}
