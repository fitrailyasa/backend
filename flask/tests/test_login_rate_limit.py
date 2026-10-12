"""Login attempt limiter: 3 failed logins / 15 min per email, 10 per IP."""

LOCK_MESSAGE = "Too many failed login attempts. Please try again later."


def _login(client, email, password="wrong-password"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_three_failures_are_401_and_the_fourth_is_429(client, make_user):
    user = make_user(email="lockout@example.com")

    for attempt in range(3):
        response = _login(client, user.email)
        body = response.get_json()

        assert response.status_code == 401, attempt
        assert body["success"] is False
        assert "errors" not in body

    locked = _login(client, user.email)
    body = locked.get_json()

    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) >= 1
    assert "X-RateLimit-Limit" in locked.headers
    assert body == {"success": False, "message": LOCK_MESSAGE}
    assert "errors" not in body


def test_correct_password_is_429_while_locked(client, make_user):
    user = make_user(email="locked-correct@example.com")

    for _ in range(3):
        assert _login(client, user.email).status_code == 401

    locked = _login(client, user.email, password="password")

    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) >= 1
    assert locked.get_json()["message"] == LOCK_MESSAGE


def test_unknown_email_failures_count(client):
    ghost = "ghost@example.com"

    for _ in range(3):
        response = _login(client, ghost)
        assert response.status_code == 401

    locked = _login(client, ghost)

    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) >= 1


def test_lockout_is_normalized_per_email(client, make_user):
    user = make_user(email="mixed@example.com")

    for _ in range(3):
        assert _login(client, "  Mixed@Example.COM  ").status_code == 401

    assert _login(client, "mixed@example.com").status_code == 429


def test_successful_login_resets_the_counter(client, make_user):
    user = make_user(email="reset@example.com")

    for _ in range(2):
        assert _login(client, user.email).status_code == 401

    success = _login(client, user.email, password="password")
    assert success.status_code == 200
    assert success.get_json()["data"]["token"]

    # The counter was cleared, so three more failures are still allowed.
    for _ in range(3):
        assert _login(client, user.email).status_code == 401

    # ...and the fourth one locks the email again.
    assert _login(client, user.email).status_code == 429


def test_lockout_is_per_email_not_per_ip(client, make_user):
    locked_user = make_user(email="a-lock@example.com")
    other_user = make_user(email="b-lock@example.com")

    for _ in range(3):
        assert _login(client, locked_user.email).status_code == 401

    assert _login(client, locked_user.email).status_code == 429

    # Same client IP, different email: still allowed.
    assert _login(client, other_user.email, password="password").status_code == 200


def test_ip_limit_after_ten_failures(client):
    for index in range(10):
        response = _login(client, f"ip-limit-{index}@example.com")
        assert response.status_code == 401

    locked = _login(client, "ip-limit-10@example.com")

    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) >= 1
    assert locked.get_json() == {"success": False, "message": LOCK_MESSAGE}


def test_failed_login_keeps_the_generic_401_message(client, make_user):
    user = make_user(email="generic-message@example.com")

    wrong_password = _login(client, user.email)
    wrong_email = _login(client, "nobody-here@example.com")

    assert wrong_password.status_code == 401
    assert wrong_email.status_code == 401
    assert wrong_password.get_json()["message"] == wrong_email.get_json()["message"]
    assert wrong_password.get_json()["message"] == "These credentials do not match our records"
    assert "errors" not in wrong_password.get_json()
    assert "errors" not in wrong_email.get_json()
