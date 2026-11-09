from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select, text

from app.models.user import User
from tests.conftest import TEST_JWT_SECRET
from tests.helpers import STRONG_PASSWORD, get_user, login_response, register, session, set_active


# ---- registration ----------------------------------------------------------------------------

def test_register_success_creates_regular_user(client):
    r = register(client, "alice")
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "alice" and body["role"] == "user" and body["is_active"] is True
    assert set(body) == {"id", "username", "role", "is_active", "created_at"}


def test_register_response_never_contains_secrets(client):
    text_ = register(client, "alice").text.lower()
    for forbidden in ("password", "hash", "argon2", STRONG_PASSWORD.lower()):
        assert forbidden not in text_


def test_password_is_stored_hashed_only(client):
    register(client, "alice")
    user = get_user(client, "alice")
    assert user.password_hash != STRONG_PASSWORD
    assert user.password_hash.startswith("$argon2id$")
    with session(client) as db:
        dump = " ".join(str(row) for row in db.execute(text("SELECT * FROM users")))
    assert STRONG_PASSWORD not in dump


@pytest.mark.parametrize("extra", [{"role": "admin"}, {"is_active": True}, {"is_admin": True}, {"id": 1}])
def test_cannot_self_assign_privileges_at_registration(client, extra):
    r = client.post("/api/v1/auth/register", json={"username": "mallory", "password": STRONG_PASSWORD, **extra})
    assert r.status_code == 422
    assert get_user(client, "mallory") is None


def test_duplicate_username_conflicts_case_insensitively(client):
    assert register(client, "alice").status_code == 201
    assert register(client, "ALICE").status_code == 409
    assert register(client, "alice").status_code == 409


def test_username_is_normalized_to_lowercase(client):
    assert register(client, "  Bob_Smith ").json()["username"] == "bob_smith"


@pytest.mark.parametrize("username", ["ab", "a" * 33, "bad name", "bad/name", "evil;drop", "emoji😀user", "", "   "])
def test_invalid_usernames_rejected(client, username):
    assert register(client, username).status_code == 422


@pytest.mark.parametrize(
    "password", ["short", "elevenchars", "a" * 129, "aaaaaaaaaaaaaaaa", "xx-alice-password-xx"]
)
def test_weak_or_invalid_passwords_rejected(client, password):
    r = register(client, "alice", password)
    assert r.status_code == 422
    assert password not in r.text  # input is never echoed back


def test_register_requires_json_body_fields(client):
    assert client.post("/api/v1/auth/register", json={}).status_code == 422
    assert client.post("/api/v1/auth/register", json={"username": "alice"}).status_code == 422
    assert client.post("/api/v1/auth/register", json={"username": 5, "password": 6}).status_code == 422


# ---- login -----------------------------------------------------------------------------------

def test_login_success_returns_bearer_token(client, settings):
    register(client, "alice")
    r = login_response(client, "alice")
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.jwt_access_token_expire_minutes * 60
    claims = jwt.decode(body["access_token"], TEST_JWT_SECRET, algorithms=["HS256"], issuer="secureai-gateway")
    assert claims["sub"] == str(get_user(client, "alice").id)
    assert "role" not in claims  # roles are always read from the database


def test_login_token_lifetime_follows_configuration(client):
    register(client, "alice")
    token = login_response(client, "alice").json()["access_token"]
    claims = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"], issuer="secureai-gateway")
    assert claims["exp"] - claims["iat"] == 30 * 60


def test_login_updates_last_login(client):
    register(client, "alice")
    assert get_user(client, "alice").last_login_at is None
    login_response(client, "alice")
    assert get_user(client, "alice").last_login_at is not None


def test_login_is_case_insensitive_on_username(client):
    register(client, "alice")
    assert login_response(client, "ALICE").status_code == 200


def test_login_failures_are_indistinguishable(client):
    register(client, "alice")
    register(client, "dormant")
    set_active(client, "dormant", False)
    wrong_pw = login_response(client, "alice", "wrong-password-123")
    unknown = login_response(client, "nobody", STRONG_PASSWORD)
    disabled = login_response(client, "dormant", STRONG_PASSWORD)
    for r in (wrong_pw, unknown, disabled):
        assert r.status_code == 401
        assert r.json() == {"error": "Unauthorized", "message": "Invalid username or password"}
        assert r.headers["www-authenticate"] == "Bearer"


def test_login_validates_input(client):
    assert client.post("/api/v1/auth/login", json={}).status_code == 422
    assert client.post("/api/v1/auth/login", json={"username": "a", "password": ""}).status_code == 422
    assert client.post("/api/v1/auth/login", json={"username": "a", "password": "x" * 129}).status_code == 422
    assert client.post("/api/v1/auth/login", json={"username": "a" * 65, "password": "x"}).status_code == 422
    assert client.post("/api/v1/auth/login", json={"username": "a", "password": "x", "role": "admin"}).status_code == 422


def test_login_with_sql_injection_payload_fails_cleanly(client):
    register(client, "alice")
    r = client.post("/api/v1/auth/login", json={"username": "alice' OR '1'='1", "password": "x' OR '1'='1"})
    assert r.status_code == 401


def test_password_is_rehashed_if_parameters_are_outdated(client):
    from argon2 import PasswordHasher

    register(client, "alice")
    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(STRONG_PASSWORD)
    with session(client) as db:
        user = db.scalar(select(User).where(User.username == "alice"))
        user.password_hash = weak
        db.commit()
    assert login_response(client, "alice").status_code == 200
    assert get_user(client, "alice").password_hash != weak


def test_expired_login_window_matches_token_expiry(client):
    register(client, "alice")
    token = login_response(client, "alice").json()["access_token"]
    claims = jwt.decode(token, TEST_JWT_SECRET, algorithms=["HS256"], issuer="secureai-gateway")
    exp = datetime.fromtimestamp(claims["exp"], UTC)
    assert timedelta(minutes=29) < exp - datetime.now(UTC) <= timedelta(minutes=30)
