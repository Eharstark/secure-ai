from tests.helpers import STRONG_PASSWORD, bearer, create_key, get_user, login, login_response, register, set_active


def test_failed_login_is_logged_without_password(client, security_log):
    register(client, "alice")
    login_response(client, "alice", "this-is-the-wrong-pw-777")
    text = security_log.text
    assert "auth_failure event=login reason=bad_password" in text
    assert "username='alice'" in text
    assert "this-is-the-wrong-pw-777" not in text and STRONG_PASSWORD not in text


def test_unknown_user_and_disabled_account_reasons_are_logged(client, security_log):
    register(client, "dormant")
    set_active(client, "dormant", False)
    login_response(client, "ghost")
    login_response(client, "dormant")
    assert "reason=unknown_user" in security_log.text
    assert "reason=inactive" in security_log.text


def test_invalid_token_failure_logged_without_token(client, security_log):
    token = "eyJhbGciOiJIUzI1NiJ9.secret-looking-payload.signature"
    client.get("/api/v1/users/me", headers=bearer(token))
    assert "auth_failure event=jwt reason=malformed_token" in security_log.text
    assert token not in security_log.text and "secret-looking-payload" not in security_log.text


def test_missing_credentials_logged(client, security_log):
    client.get("/api/v1/users/me")
    assert "reason=missing_credentials" in security_log.text
    assert "path=/api/v1/users/me" in security_log.text


def test_api_key_failure_logs_prefix_only(client, user_headers, security_log):
    key = create_key(client, user_headers).json()["api_key"]
    bad = key[:-1] + ("A" if key[-1] != "A" else "B")
    client.get("/api/v1/users/me", headers={"X-API-Key": bad})
    prefix = key.split("_")[1]
    assert "auth_failure event=api_key reason=unknown_key" in security_log.text
    assert f"key_prefix='{prefix}'" in security_log.text
    secret_part = key.split("_", 2)[2]
    assert secret_part not in security_log.text and bad not in security_log.text and key not in security_log.text


def test_malformed_api_key_not_logged_verbatim(client, security_log):
    client.get("/api/v1/users/me", headers={"X-API-Key": "super-secret-looking-garbage"})
    assert "reason=malformed" in security_log.text
    assert "super-secret-looking-garbage" not in security_log.text


def test_authorization_failures_are_logged(client, user_headers, security_log):
    client.get("/api/v1/admin/users", headers=user_headers)
    assert "authz_failure reason=insufficient_role" in security_log.text
    assert f"user_id={get_user(client, 'alice').id}" in security_log.text


def test_log_injection_is_neutralized(client, security_log):
    client.post("/api/v1/auth/login", json={"username": "evil\nauth_success FORGED\r\nline", "password": "x"})
    text = security_log.text
    assert "\n" not in text.split("username=")[1].split(" key_prefix")[0]
    assert "\r" not in text
    assert all("FORGED" not in r.getMessage().splitlines()[0][:12] for r in security_log.records)
    assert len(security_log.records) == 1  # one event -> one record


def test_long_usernames_are_truncated_in_logs(client, security_log):
    client.post("/api/v1/auth/login", json={"username": "u" * 64, "password": "x"})
    assert "u" * 65 not in security_log.text


def test_successful_login_logs_no_credentials(client, security_log):
    register(client, "alice")
    token = login(client, "alice")
    assert "login_success" in security_log.text
    assert token not in security_log.text and STRONG_PASSWORD not in security_log.text


def test_api_key_creation_does_not_log_the_key(client, user_headers, security_log):
    key = create_key(client, user_headers).json()["api_key"]
    assert "api_key_created" in security_log.text
    assert key not in security_log.text
