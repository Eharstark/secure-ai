from tests.helpers import STRONG_PASSWORD, bearer, create_key, get_user, login, register, set_role


def test_admin_endpoints_require_authentication(client):
    assert client.get("/api/v1/admin/users").status_code == 401
    assert client.patch("/api/v1/admin/users/1", json={"is_active": False}).status_code == 401


def test_regular_user_gets_403_on_admin_endpoints(client, user_headers):
    r = client.get("/api/v1/admin/users", headers=user_headers)
    assert r.status_code == 403
    assert r.json() == {"error": "Forbidden", "message": "Insufficient permissions"}
    assert client.patch("/api/v1/admin/users/1", json={"role": "admin"}, headers=user_headers).status_code == 403


def test_user_cannot_promote_themselves(client, user_headers):
    uid = get_user(client, "alice").id
    assert client.patch(f"/api/v1/admin/users/{uid}", json={"role": "admin"}, headers=user_headers).status_code == 403
    assert get_user(client, "alice").role == "user"


def test_admin_can_list_users_without_secrets(client, admin_headers, user_headers):
    r = client.get("/api/v1/admin/users", headers=admin_headers)
    assert r.status_code == 200
    users = r.json()
    assert {u["username"] for u in users} == {"root-admin", "alice"}
    for u in users:
        assert set(u) == {"id", "username", "role", "is_active", "created_at"}
    assert "argon2" not in r.text and "password" not in r.text.lower()


def test_admin_list_pagination_and_validation(client, admin_headers, user_headers):
    assert len(client.get("/api/v1/admin/users?limit=1", headers=admin_headers).json()) == 1
    assert len(client.get("/api/v1/admin/users?limit=1&offset=1", headers=admin_headers).json()) == 1
    for q in ("limit=0", "limit=101", "offset=-1", "limit=abc"):
        assert client.get(f"/api/v1/admin/users?{q}", headers=admin_headers).status_code == 422


def test_admin_can_promote_and_demote_users(client, admin_headers, user_headers):
    uid = get_user(client, "alice").id
    r = client.patch(f"/api/v1/admin/users/{uid}", json={"role": "admin"}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert client.get("/api/v1/admin/users", headers=user_headers).status_code == 200  # alice now admin
    client.patch(f"/api/v1/admin/users/{uid}", json={"role": "user"}, headers=admin_headers)
    assert client.get("/api/v1/admin/users", headers=user_headers).status_code == 403


def test_admin_can_deactivate_user(client, admin_headers, user_headers):
    uid = get_user(client, "alice").id
    assert client.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False}, headers=admin_headers).status_code == 200
    assert client.get("/api/v1/users/me", headers=user_headers).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "alice", "password": STRONG_PASSWORD}).status_code == 401


def test_admin_cannot_modify_self(client, admin_headers):
    uid = get_user(client, "root-admin").id
    assert client.patch(f"/api/v1/admin/users/{uid}", json={"role": "user"}, headers=admin_headers).status_code == 403
    assert client.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False}, headers=admin_headers).status_code == 403
    assert get_user(client, "root-admin").role == "admin"


def test_admin_update_validation(client, admin_headers, user_headers):
    uid = get_user(client, "alice").id
    for payload in ({}, {"role": "superuser"}, {"role": "root"}, {"is_active": "maybe"}, {"password_hash": "x"}, {"username": "x"}):
        assert client.patch(f"/api/v1/admin/users/{uid}", json=payload, headers=admin_headers).status_code == 422, payload
    assert client.patch("/api/v1/admin/users/999999", json={"is_active": True}, headers=admin_headers).status_code == 404
    assert client.patch("/api/v1/admin/users/0", json={"is_active": True}, headers=admin_headers).status_code == 422


def test_admin_endpoints_refuse_api_keys_even_for_admins(client, admin_headers):
    key = create_key(client, admin_headers).json()["api_key"]
    r = client.get("/api/v1/admin/users", headers={"X-API-Key": key})
    assert r.status_code == 403
    assert "session" in r.json()["message"].lower()


def test_registered_users_are_never_admins(client):
    for i in range(3):
        assert register(client, f"user-{i}").json()["role"] == "user"
