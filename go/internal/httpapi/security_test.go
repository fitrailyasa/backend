package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func performHeaders(s *Server, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	rec := httptest.NewRecorder()
	s.engine.ServeHTTP(rec, req)
	return rec
}

func TestGlobalRateLimitExcludesHealth(t *testing.T) {
	s := newTestServer(t)
	// The limiter is skipped automatically inside test binaries; opt in here.
	s.rateSkip = false
	s.cfg.RateEnabled = true
	s.cfg.RateMax = 3
	s.cfg.RateWindowMS = 60000

	for i := 0; i < 3; i++ {
		if rec := perform(s, http.MethodGet, "/health", "", ""); rec.Code != http.StatusOK {
			t.Fatalf("health probe %d counted against the limit: %d", i+1, rec.Code)
		}
	}
	for i := 1; i <= 3; i++ {
		rec := perform(s, http.MethodGet, "/api/v1/products", "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: status %d, want 200", i, rec.Code)
		}
		if limit := rec.Header().Get("X-RateLimit-Limit"); limit != "3" {
			t.Fatalf("request %d: X-RateLimit-Limit %q", i, limit)
		}
	}

	blocked := perform(s, http.MethodGet, "/api/v1/products", "", "")
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("4th request: status %d, want 429, body %s", blocked.Code, blocked.Body.String())
	}
	retry, err := strconv.Atoi(blocked.Header().Get("Retry-After"))
	if err != nil || retry < 1 {
		t.Fatalf("Retry-After %q must be an integer >= 1", blocked.Header().Get("Retry-After"))
	}
	payload := decode(t, blocked)
	if payload["success"] != false || payload["message"] != "Too many requests, please try again later" {
		t.Fatalf("envelope %#v", payload)
	}
	if _, exists := payload["errors"]; exists {
		t.Fatalf("429 envelope must not carry an errors key: %#v", payload)
	}
	// /health stays open while the API is rate limited.
	if rec := perform(s, http.MethodGet, "/health", "", ""); rec.Code != http.StatusOK {
		t.Fatalf("health while limited: status %d", rec.Code)
	}
}

func TestGlobalRateLimitSkippedInTestsByDefault(t *testing.T) {
	s := newTestServer(t)
	s.cfg.RateEnabled = true
	s.cfg.RateMax = 2
	s.cfg.RateWindowMS = 60000
	for i := 0; i < 10; i++ {
		if rec := perform(s, http.MethodGet, "/api/v1/products", "", ""); rec.Code != http.StatusOK {
			t.Fatalf("request %d limited in a test binary: %d", i+1, rec.Code)
		}
	}
}

func TestSecurityHeaders(t *testing.T) {
	s := newTestServer(t)
	rec := perform(s, http.MethodGet, "/api/v1/products", "", "")
	header := rec.Header()
	expected := map[string]string{
		"X-Content-Type-Options":     "nosniff",
		"X-Frame-Options":            "DENY",
		"Referrer-Policy":            "no-referrer",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Permissions-Policy":         "camera=(), microphone=(), geolocation=()",
		"Content-Security-Policy":    "default-src 'none'",
	}
	for name, value := range expected {
		if got := header.Get(name); got != value {
			t.Errorf("%s = %q, want %q", name, got, value)
		}
	}
	if server := header.Get("Server"); server != "" {
		t.Errorf("Server header leaked: %q", server)
	}

	// The Swagger UI page is the one relaxation of the CSP (documented in README).
	docs := perform(s, http.MethodGet, "/api/v1/docs", "", "")
	if csp := docs.Header().Get("Content-Security-Policy"); !strings.Contains(csp, "cdn.jsdelivr.net") {
		t.Errorf("docs CSP does not allow its own assets: %q", csp)
	}
}

func TestHSTSOnlyWhenEnabledAndHTTPS(t *testing.T) {
	s := newTestServer(t)
	s.cfg.EnableHSTS = true

	if rec := perform(s, http.MethodGet, "/health", "", ""); rec.Header().Get("Strict-Transport-Security") != "" {
		t.Fatal("HSTS sent on a plain HTTP request")
	}

	req := httptest.NewRequest(http.MethodGet, "https://localhost/health", nil)
	rec := httptest.NewRecorder()
	s.engine.ServeHTTP(rec, req)
	if rec.Header().Get("Strict-Transport-Security") == "" {
		t.Fatal("HSTS missing on an HTTPS request with ENABLE_HSTS on")
	}

	s.cfg.EnableHSTS = false
	rec = httptest.NewRecorder()
	s.engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "https://localhost/health", nil))
	if rec.Header().Get("Strict-Transport-Security") != "" {
		t.Fatal("HSTS sent while ENABLE_HSTS is off")
	}
}

func TestCORSAllowlist(t *testing.T) {
	s := newTestServer(t) // CORSOrigin = config.DefaultCORSOrigins

	allowed := performHeaders(s, http.MethodGet, "/api/v1/products", "", map[string]string{
		"Origin": "http://localhost:5173",
	})
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("allowed origin echoed as %q", got)
	}
	if !strings.Contains(allowed.Header().Get("Vary"), "Origin") {
		t.Fatalf("Vary header missing: %q", allowed.Header().Get("Vary"))
	}
	if allowed.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatal("credentialed allowlisted origin must get Allow-Credentials")
	}
	if maxAge := allowed.Header().Get("Access-Control-Max-Age"); maxAge != "600" {
		t.Fatalf("preflight cache %q, want 600", maxAge)
	}

	blocked := performHeaders(s, http.MethodGet, "/api/v1/products", "", map[string]string{
		"Origin": "https://evil.example",
	})
	if got := blocked.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unlisted origin was allowed: %q", got)
	}

	noOrigin := perform(s, http.MethodGet, "/api/v1/products", "", "")
	if got := noOrigin.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("ACAO without an Origin request header: %q", got)
	}
	if !strings.Contains(noOrigin.Header().Get("Vary"), "Origin") {
		t.Fatalf("Vary header missing: %q", noOrigin.Header().Get("Vary"))
	}

	preflight := performHeaders(s, http.MethodOptions, "/api/v1/products", "", map[string]string{
		"Origin": "http://localhost:3000",
	})
	if preflight.Code != http.StatusNoContent || preflight.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("preflight %d ACAO %q", preflight.Code, preflight.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSWildcardWithoutCredentials(t *testing.T) {
	s := newTestServer(t)
	s.cfg.CORSOrigin = "*"
	rec := performHeaders(s, http.MethodGet, "/api/v1/products", "", map[string]string{
		"Origin": "https://anywhere.example",
	})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("ACAO %q, want *", got)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal("credentials must never accompany the * origin")
	}
}

func TestBodyLimitUsesStandardEnvelope(t *testing.T) {
	s := newTestServer(t)
	s.cfg.BodyLimit = 16
	rec := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"Too Big","email":"big@example.com","password":"password","password_confirmation":"password"
	}`, "")
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, want 413, body %s", rec.Code, rec.Body.String())
	}
	payload := decode(t, rec)
	if payload["success"] != false || payload["message"] == "" {
		t.Fatalf("envelope %#v", payload)
	}
	if _, exists := payload["errors"]; exists {
		t.Fatalf("413 envelope must not carry an errors key: %#v", payload)
	}
}
