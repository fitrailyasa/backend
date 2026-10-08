"""Health, auth, validation, and error envelope."""

import jwt as pyjwt

from tests.conftest import auth


def test_health_is_not_enveloped(client):
    response = client.get("/health")
    body = response.get_json()

    assert response.status_code == 200
    assert body["status"] == "ok"
    assert isinstance(body["uptime"], (int, float))
    assert body["uptime"] >= 0
    assert isinstance(body["timestamp"], str)
    assert "success" not in body


def test_api_index(client):
    response = client.get("/api/v1")
    body = response.get_json()

    assert response.status_code == 200
    assert body["success"] is True
    assert body["message"] == "API index retrieved"
    assert body["data"]["prefix"] == "/api/v1"
    assert any(item["path"] == "/api/v1/auth/login" for item in body["data"]["endpoints"])


def test_register_login_and_me(client):
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "name": "John Doe",
            "email": "john@example.com",
            "password": "password",
            "password_confirmation": "password",
            "role": "admin",
        },
    )
    body = registered.get_json()

    assert registered.status_code == 201
    assert body["message"] == "User registered successfully"
    assert body["data"]["user"]["email"] == "john@example.com"
    assert body["data"]["user"]["role"] == "user"
    assert body["data"]["token_type"] == "Bearer"
    assert body["data"]["expires_in"] == 3600
    assert "password" not in body["data"]["user"]
    assert "$2b$" not in registered.get_data(as_text=True)

    logged = client.post("/api/v1/auth/login", json={"email": "john@example.com", "password": "password"})
    token = logged.get_json()["data"]["token"]
    assert logged.status_code == 200
    assert logged.get_json()["message"] == "Login successful"
    assert "password" not in logged.get_json()["data"]["user"]

    me = client.get("/api/v1/auth/me", headers=auth(token))
    assert me.status_code == 200
    assert me.get_json()["data"]["email"] == "john@example.com"
    assert "password" not in me.get_json()["data"]

    payload = pyjwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
    assert payload["sub"] == str(body["data"]["user"]["id"])
    assert payload["role"] == "user"
    assert payload["typ"] == "access"
    assert payload["jti"]
    assert payload["exp"] - payload["iat"] == 3600

    refresh = pyjwt.decode(body["data"]["refresh_token"], options={"verify_signature": False}, algorithms=["HS256"])
    assert refresh["typ"] == "refresh"
    assert refresh["exp"] - refresh["iat"] == 604800


def test_duplicate_email_is_422(client):
    payload = {
        "name": "First",
        "email": "taken@example.com",
        "password": "password",
        "password_confirmation": "password",
    }
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    second = client.post("/api/v1/auth/register", json={**payload, "name": "Second"})
    body = second.get_json()

    assert second.status_code == 422
    assert body["success"] is False
    assert body["message"] == "Validation failed"
    assert body["errors"]["email"] == ["The email has already been taken."]


def test_short_password_and_confirmation_are_422(client):
    short = client.post(
        "/api/v1/auth/register",
        json={"name": "Short", "email": "short@example.com", "password": "short", "password_confirmation": "short"},
    )
    assert short.status_code == 422
    assert isinstance(short.get_json()["errors"]["password"], list)

    mismatch = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Mismatch",
            "email": "mismatch@example.com",
            "password": "password",
            "password_confirmation": "different",
        },
    )
    assert mismatch.status_code == 422
    assert isinstance(mismatch.get_json()["errors"]["password_confirmation"], list)


def test_bad_login_is_401_without_errors(client, make_user):
    user = make_user(email="login@example.com")
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "wrong-password"})
    body = response.get_json()

    assert response.status_code == 401
    assert body["success"] is False
    assert body["message"] == "These credentials do not match our records"
    assert "errors" not in body


def test_missing_and_expired_token(client, make_user, app):
    assert client.get("/api/v1/auth/me").status_code == 401

    user = make_user()
    import time

    expired = pyjwt.encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "typ": "access",
            "jti": "expired-jti",
            "iat": int(time.time()) - 120,
            "exp": int(time.time()) - 60,
            "iss": app.config["JWT_ISSUER"],
            "aud": app.config["JWT_AUDIENCE"],
        },
        app.config["JWT_ACCESS_SECRET"],
        algorithm="HS256",
    )
    response = client.get("/api/v1/auth/me", headers=auth(expired))
    assert response.status_code == 401
    assert response.get_json()["message"] == "Token has expired"


def test_refresh_accepts_body_or_bearer(client, make_user):
    user = make_user(email="refresh@example.com")
    tokens = client.post("/api/v1/auth/login", json={"email": user.email, "password": "password"}).get_json()["data"]

    by_field = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
        headers=auth(tokens["token"]),
    )
    assert by_field.status_code == 200
    assert "password" not in by_field.get_json()["data"]["user"]

    by_alias = client.post("/api/v1/auth/refresh", json={"token": tokens["refresh_token"]})
    assert by_alias.status_code == 200

    by_bearer = client.post("/api/v1/auth/refresh", headers=auth(tokens["refresh_token"]))
    assert by_bearer.status_code == 200
    assert by_bearer.get_json()["data"]["token"]


def test_logout_revokes_access_token(client, make_user):
    user = make_user(email="logout@example.com")
    token = client.post("/api/v1/auth/login", json={"email": user.email, "password": "password"}).get_json()["data"]["token"]
    logout = client.post("/api/v1/auth/logout", headers=auth(token))
    assert logout.status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth(token)).status_code == 401


def test_malformed_json_and_unknown_route(client):
    bad = client.post("/api/v1/auth/login", data='{"email":', headers={"Content-Type": "application/json"})
    assert bad.status_code == 400
    assert bad.get_json()["success"] is False
    assert "errors" not in bad.get_json()

    missing = client.get("/api/v1/does-not-exist")
    assert missing.status_code == 404
    assert missing.get_json()["success"] is False
    assert "errors" not in missing.get_json()


def test_internal_error_is_sanitized(client):
    response = client.get("/__test_error")
    body = response.get_json()
    assert response.status_code == 500
    assert body == {"success": False, "message": "Internal server error"}
    assert "secret stack detail" not in response.get_data(as_text=True)
    assert "Traceback" not in response.get_data(as_text=True)


def test_regular_user_is_forbidden_on_admin_route(client, make_user, login):
    user = make_user(email="member@example.com")
    token = login(user.email)["token"]
    response = client.get("/api/v1/users", headers=auth(token))
    assert response.status_code == 403
    assert response.get_json()["success"] is False
    assert "errors" not in response.get_json()
