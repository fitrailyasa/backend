package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

const lockedMessage = "Too many failed login attempts. Please try again later."

func attemptLogin(s *Server, email, password string) *httptest.ResponseRecorder {
	return perform(s, http.MethodPost, "/api/v1/auth/login", fmt.Sprintf(
		`{"email":%q,"password":%q}`, email, password), "")
}

// assertLoginLocked checks the _SECURITY_SPEC.md 1.2 contract: HTTP 429,
// Retry-After >= 1 and the standard envelope without an errors key.
func assertLoginLocked(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status %d, want 429, body %s", rec.Code, rec.Body.String())
	}
	retry := rec.Header().Get("Retry-After")
	seconds, err := strconv.Atoi(retry)
	if err != nil || seconds < 1 {
		t.Fatalf("Retry-After %q must be an integer >= 1", retry)
	}
	payload := decode(t, rec)
	if payload["success"] != false || payload["message"] != lockedMessage {
		t.Fatalf("envelope %#v", payload)
	}
	if _, exists := payload["errors"]; exists {
		t.Fatalf("429 envelope must not carry an errors key: %#v", payload)
	}
}

func TestLoginLockoutAfterThreeFailures(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "Locked User", "locked@example.com")
	for attempt := 1; attempt <= 3; attempt++ {
		rec := attemptLogin(s, "locked@example.com", "wrong-password")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: status %d, want 401, body %s", attempt, rec.Code, rec.Body.String())
		}
		// One generic message for both wrong email and wrong password.
		if message, _ := decode(t, rec)["message"].(string); message != invalidCredentialsMessage {
			t.Fatalf("attempt %d: message %q must be the generic 401 message", attempt, message)
		}
	}
	assertLoginLocked(t, attemptLogin(s, "locked@example.com", "wrong-password"))
}

func TestLoginLockoutBlocksCorrectPassword(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "Locked User", "correct-when-locked@example.com")
	for i := 0; i < 3; i++ {
		if rec := attemptLogin(s, "correct-when-locked@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: status %d", i+1, rec.Code)
		}
	}
	assertLoginLocked(t, attemptLogin(s, "correct-when-locked@example.com", "password"))
}

func TestLoginLockoutCountsUnknownEmail(t *testing.T) {
	s := newTestServer(t)
	// Two failures while the account does not exist yet.
	for i := 0; i < 2; i++ {
		if rec := attemptLogin(s, "ghost@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("unknown-email failure %d: status %d", i+1, rec.Code)
		}
	}
	// The account appears; its first real failure is the third for this email.
	register(t, s, "Ghost", "ghost@example.com")
	if rec := attemptLogin(s, "ghost@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("third failure: status %d", rec.Code)
	}
	assertLoginLocked(t, attemptLogin(s, "ghost@example.com", "password"))
}

func TestLoginSuccessResetsCounter(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "Resettable", "reset@example.com")
	// Two failures stay below the lock threshold so a success can run.
	// Without a reset the third failure below would already return 429.
	for i := 0; i < 2; i++ {
		if rec := attemptLogin(s, "reset@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: status %d", i+1, rec.Code)
		}
	}
	if rec := attemptLogin(s, "reset@example.com", "password"); rec.Code != http.StatusOK {
		t.Fatalf("login after failures: status %d body %s", rec.Code, rec.Body.String())
	}
	// Three more failures are allowed because the success cleared the counter.
	for i := 0; i < 3; i++ {
		if rec := attemptLogin(s, "reset@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("post-reset failure %d: status %d", i+1, rec.Code)
		}
	}
	assertLoginLocked(t, attemptLogin(s, "reset@example.com", "wrong-password"))
}

func TestLoginLockoutIsPerEmail(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "First", "first@example.com")
	register(t, s, "Second", "second@example.com")
	for i := 0; i < 3; i++ {
		if rec := attemptLogin(s, "first@example.com", "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: status %d", i+1, rec.Code)
		}
	}
	assertLoginLocked(t, attemptLogin(s, "first@example.com", "password"))
	// Locking first@example.com must not lock second@example.com.
	if rec := attemptLogin(s, "second@example.com", "password"); rec.Code != http.StatusOK {
		t.Fatalf("second account affected by first's lock: status %d body %s", rec.Code, rec.Body.String())
	}
	// ...and first stays locked afterwards.
	assertLoginLocked(t, attemptLogin(s, "first@example.com", "password"))
}

func TestLoginLockoutNormalizesEmail(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "Normalized", "normal@example.com")
	for i := 0; i < 3; i++ {
		rec := attemptLogin(s, "  Normal@Example.COM ", "wrong-password")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: status %d", i+1, rec.Code)
		}
	}
	assertLoginLocked(t, attemptLogin(s, "normal@example.com", "password"))
}

func TestLoginLockoutPerIP(t *testing.T) {
	s := newTestServer(t)
	// Ten failed logins from one client IP, each against its own email.
	for i := 1; i <= 10; i++ {
		email := fmt.Sprintf("ip%d@example.com", i)
		register(t, s, fmt.Sprintf("IP User %d", i), email)
		if rec := attemptLogin(s, email, "wrong-password"); rec.Code != http.StatusUnauthorized {
			t.Fatalf("failure %d: status %d", i, rec.Code)
		}
	}
	// The IP is locked now even though this email never failed.
	register(t, s, "IP User 11", "ip11@example.com")
	assertLoginLocked(t, attemptLogin(s, "ip11@example.com", "password"))
}
