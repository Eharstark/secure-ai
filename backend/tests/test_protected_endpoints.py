from datetime import UTC, datetime, timedelta

import jwt

from app.core.security import create_access_token
from tests.conftest import TEST_JWT_SECRET, make_settings
from tests.helpers import STRONG_PASSWORD, bearer, get_user, login, register, set_active, set_role


def test_me_requires_authentication(client):
    r = client.get("/api/v1/users/me")
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"
    assert r.json()["message"] == "Authentication required"


def test_me_with_valid_token(client, user_headers):
    r = client.get("/api/v1/users/me", headers=user_headers)
    assert r.status_code == 200
    assert r.json()["username"] == "alice"
    assert "password" not in r.text.lower()


def test_expired_token_gets_401(client):
    register(client, "alice")
    uid = get_user(client, "alice").id
    token, _ = create_access_token(
        str(uid), make_settings(), now=datetime.now(UTC) - timedelta(hours=1), expires_delta=timedelta(minutes=5)
    )
    r = client.get("/api/v1/users/me", headers=bearer(token))
    assert r.status_code == 401
    assert r.json()["message"] == "Token has expired"
    assert r.headers["www-authenticate"] == "Bearer"


def test_token_signed_with_other_secret_gets_401(client):
    register(client, "alice")
    token, _ = create_access_token(str(get_user(client, "alice").id), make_settings(jwt_secret_key="q" * 64))
    r = client.get("/api/v1/users/me", headers=bearer(token))
    assert r.status_code == 401 and r.json()["message"] == "Invalid authentication credentials"


def test_alg_none_token_gets_401(client):
    register(client, "alice")
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": str(get_user(client, "alice").id), "iss": "secureai-gateway", "iat": now, "exp": now + timedelta(minutes=5)},
        key=None,
        algorithm="none",
    )
    assert client.get("/api/v1/users/me", headers=bearer(token)).status_code == 401


def test_garbage_and_malformed_authorization_headers(client):
    assert client.get("/api/v1/users/me", headers=bearer("garbage")).status_code == 401
    assert client.get("/api/v1/users/me", headers={"Authorization": "Basic dXNlcjpwdw=="}).status_code == 401
    assert client.get("/api/v1/users/me", headers={"Authorization": "Bearer"}).status_code == 401
    assert client.get("/api/v1/users/me", headers={"Authorization": ""}).status_code == 401


def test_non_numeric_subject_gets_401(client):
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "not-a-number", "iss": "secureai-gateway", "iat": now, "exp": now + timedelta(minutes=5)},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    assert client.get("/api/v1/users/me", headers=bearer(token)).status_code == 401


def test_token_for_unknown_user_gets_401(client):
    token, _ = create_access_token("99999", make_settings())
    assert client.get("/api/v1/users/me", headers=bearer(token)).status_code == 401


def test_token_stops_working_when_user_is_deactivated(client, user_headers):
    assert client.get("/api/v1/users/me", headers=user_headers).status_code == 200
    set_active(client, "alice", False)
    assert client.get("/api/v1/users/me", headers=user_headers).status_code == 401


def test_health_and_root_stay_public(client):
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/").status_code == 200


def test_role_comes_from_database_not_token(client, admin_headers):
    assert client.get("/api/v1/admin/users", headers=admin_headers).status_code == 200
    set_role(client, "root-admin", "user")  # demote: the old admin token must lose access immediately
    assert client.get("/api/v1/admin/users", headers=admin_headers).status_code == 403
