"""Hardening: security headers, CORS allowlist, body cap, global rate limit."""


def test_security_headers_on_every_response(client):
    response = client.get("/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'"
    assert "Strict-Transport-Security" not in response.headers
    assert "Server" not in response.headers
    assert "X-Powered-By" not in response.headers


def test_security_headers_on_error_responses(client):
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'"


def test_hsts_only_when_enabled_and_https(app):
    app.config["ENABLE_HSTS"] = True
    client = app.test_client()

    plain = client.get("/health")
    secure = client.get("/health", base_url="https://localhost")

    assert "Strict-Transport-Security" not in plain.headers
    assert secure.headers["Strict-Transport-Security"].startswith("max-age=")


def test_cors_allowlist_with_credentials(client):
    allowed = client.get("/api/v1/categories", headers={"Origin": "http://localhost:5173"})
    denied = client.get("/api/v1/categories", headers={"Origin": "http://evil.example"})

    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert allowed.headers["Access-Control-Allow-Credentials"] == "true"
    assert "origin" in allowed.headers.get("Vary", "").lower()
    assert denied.headers.get("Access-Control-Allow-Origin") is None


def test_cors_preflight_reports_600s_max_age(client):
    response = client.open(
        "/api/v1/categories",
        method="OPTIONS",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code in (200, 204)
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
    assert response.headers["Access-Control-Max-Age"] == "600"


def test_oversized_body_is_413_with_envelope(client):
    payload = b'{"name": "' + b"a" * 110_000 + b'"}'
    response = client.post("/api/v1/auth/register", data=payload, content_type="application/json")
    body = response.get_json()

    assert response.status_code == 413
    assert body["success"] is False
    assert "errors" not in body


def test_global_rate_limit_returns_429(app, client):
    app.config["RATE_LIMIT_ENABLED"] = True
    app.config["RATE_LIMIT_MAX"] = 5

    for _ in range(5):
        assert client.get("/api/v1/categories").status_code == 200

    blocked = client.get("/api/v1/categories")
    body = blocked.get_json()

    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1
    assert body["success"] is False
    assert "errors" not in body

    # /health stays exempt even when over the limit.
    assert client.get("/health").status_code == 200
