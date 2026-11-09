import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from app.models.api_key import ApiKey
from tests.helpers import bearer, create_key, get_user, login, register, session, set_active


def _key_row(client, key_id):
    with session(client) as db:
        return db.get(ApiKey, key_id)


def test_create_key_returns_plaintext_once(client, user_headers):
    r = create_key(client, user_headers, "ci-pipeline")
    assert r.status_code == 201
    body = r.json()
    assert body["api_key"].startswith("sagw_") and body["prefix"] in body["api_key"]
    assert body["name"] == "ci-pipeline" and body["revoked"] is False and body["expires_at"] is None
    assert "key_hash" not in body and "hash" not in " ".join(body)


def test_only_hash_is_stored_never_plaintext(client, user_headers):
    body = create_key(client, user_headers).json()
    row = _key_row(client, body["id"])
    assert row.key_hash == hashlib.sha256(body["api_key"].encode()).hexdigest()
    assert body["api_key"] not in row.key_hash
    with session(client) as db:
        dump = " ".join(str(r) for r in db.execute(text("SELECT * FROM api_keys")))
    assert body["api_key"] not in dump
    assert body["api_key"].split("_", 2)[2] not in dump  # not even the secret part


def test_list_never_exposes_key_or_hash(client, user_headers):
    created = create_key(client, user_headers).json()
    r = client.get("/api/v1/api-keys", headers=user_headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1 and items[0]["id"] == created["id"]
    assert "api_key" not in items[0] and "key_hash" not in items[0]
    assert created["api_key"] not in r.text
    assert _key_row(client, created["id"]).key_hash not in r.text


def test_api_key_authenticates_requests(client, user_headers):
    key = create_key(client, user_headers).json()["api_key"]
    r = client.get("/api/v1/users/me", headers={"X-API-Key": key})
    assert r.status_code == 200 and r.json()["username"] == "alice"


def test_last_used_is_recorded(client, user_headers):
    created = create_key(client, user_headers).json()
    assert _key_row(client, created["id"]).last_used_at is None
    client.get("/api/v1/users/me", headers={"X-API-Key": created["api_key"]})
    assert _key_row(client, created["id"]).last_used_at is not None


def test_invalid_api_keys_get_401(client, user_headers):
    real = create_key(client, user_headers).json()["api_key"]
    tampered = real[:-1] + ("A" if real[-1] != "A" else "B")
    same_prefix_wrong_secret = real[: real.rfind("_") + 1] + "A" * 43
    for bad in ["", "nonsense", "sagw_deadbeef_" + "A" * 43, tampered, same_prefix_wrong_secret, real + " ", "x" * 4000]:
        r = client.get("/api/v1/users/me", headers={"X-API-Key": bad})
        assert r.status_code == 401, bad
        assert r.headers["www-authenticate"] == "Bearer"


def test_revoked_key_stops_working(client, user_headers):
    created = create_key(client, user_headers).json()
    headers = {"X-API-Key": created["api_key"]}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
    assert client.delete(f"/api/v1/api-keys/{created['id']}", headers=user_headers).status_code == 204
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    assert client.get("/api/v1/api-keys", headers=user_headers).json()[0]["revoked"] is True
    assert client.delete(f"/api/v1/api-keys/{created['id']}", headers=user_headers).status_code == 204  # idempotent


def test_expired_key_is_rejected(client, user_headers):
    created = create_key(client, user_headers, expires_in_days=7).json()
    assert created["expires_at"] is not None
    headers = {"X-API-Key": created["api_key"]}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 200
    with session(client) as db:
        row = db.get(ApiKey, created["id"])
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401


def test_key_of_deactivated_user_is_rejected(client, user_headers):
    key = create_key(client, user_headers).json()["api_key"]
    set_active(client, "alice", False)
    assert client.get("/api/v1/users/me", headers={"X-API-Key": key}).status_code == 401


def test_api_key_cannot_manage_keys(client, user_headers):
    key = create_key(client, user_headers).json()["api_key"]
    headers = {"X-API-Key": key}
    assert client.post("/api/v1/api-keys", json={"name": "x"}, headers=headers).status_code == 403
    assert client.get("/api/v1/api-keys", headers=headers).status_code == 403
    assert client.delete("/api/v1/api-keys/1", headers=headers).status_code == 403


def test_key_management_requires_authentication(client):
    assert client.post("/api/v1/api-keys", json={"name": "x"}).status_code == 401
    assert client.get("/api/v1/api-keys").status_code == 401
    assert client.delete("/api/v1/api-keys/1").status_code == 401


def test_users_cannot_see_or_revoke_each_others_keys(client, user_headers):
    created = create_key(client, user_headers).json()
    register(client, "bobby")
    bob = bearer(login(client, "bobby"))
    assert client.get("/api/v1/api-keys", headers=bob).json() == []
    assert client.delete(f"/api/v1/api-keys/{created['id']}", headers=bob).status_code == 404
    assert client.get("/api/v1/users/me", headers={"X-API-Key": created["api_key"]}).status_code == 200


def test_admin_can_revoke_any_key(client, user_headers, admin_headers):
    created = create_key(client, user_headers).json()
    assert client.delete(f"/api/v1/api-keys/{created['id']}", headers=admin_headers).status_code == 204
    assert client.get("/api/v1/users/me", headers={"X-API-Key": created["api_key"]}).status_code == 401


def test_revoking_missing_key_is_404(client, user_headers):
    assert client.delete("/api/v1/api-keys/424242", headers=user_headers).status_code == 404
    assert client.delete("/api/v1/api-keys/0", headers=user_headers).status_code == 422


def test_key_input_validation(client, user_headers):
    for payload in [{}, {"name": ""}, {"name": "   "}, {"name": "x" * 65}, {"name": "ok", "expires_in_days": 0},
                    {"name": "ok", "expires_in_days": 366}, {"name": "ok", "user_id": 1}, {"name": "ok", "key_hash": "a"}]:
        assert client.post("/api/v1/api-keys", json=payload, headers=user_headers).status_code == 422, payload


def test_active_key_limit(client, user_headers):
    for i in range(10):
        assert create_key(client, user_headers, f"k{i}").status_code == 201
    assert create_key(client, user_headers, "one-too-many").status_code == 409
    first = client.get("/api/v1/api-keys", headers=user_headers).json()[0]["id"]
    client.delete(f"/api/v1/api-keys/{first}", headers=user_headers)
    assert create_key(client, user_headers, "after-revoke").status_code == 201


def test_keys_are_unique_per_creation(client, user_headers):
    a = create_key(client, user_headers, "a").json()
    b = create_key(client, user_headers, "b").json()
    assert a["api_key"] != b["api_key"] and a["prefix"] != b["prefix"]


def test_bearer_takes_precedence_over_api_key(client, user_headers):
    key = create_key(client, user_headers).json()["api_key"]
    r = client.get("/api/v1/users/me", headers={**bearer("garbage"), "X-API-Key": key})
    assert r.status_code == 401  # a bad bearer token is not rescued by a valid key
