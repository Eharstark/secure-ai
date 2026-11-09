"""CORS behaviour for the React dashboard (Vite dev server on port 5173)."""

from app.core.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from tests.conftest import make_settings

VITE_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _client(**overrides) -> TestClient:
    return TestClient(create_app(make_settings(cors_origins=VITE_ORIGINS, **overrides)))


def test_vite_dev_origins_are_accepted():
    with _client() as c:
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            r = c.get("/api/v1/health", headers={"Origin": origin})
            assert r.headers.get("access-control-allow-origin") == origin


def test_preflight_for_dashboard_requests():
    with _client() as c:
        r = c.options(
            "/api/v1/admin/users/2",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert r.status_code == 200
        assert "PATCH" in r.headers["access-control-allow-methods"]
        allowed = r.headers["access-control-allow-headers"].lower()
        assert "authorization" in allowed and "content-type" in allowed


def test_delete_preflight_allowed_for_key_revocation():
    with _client() as c:
        r = c.options(
            "/api/v1/api-keys/1",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "DELETE", "Access-Control-Request-Headers": "authorization"},
        )
        assert r.status_code == 200
        assert "DELETE" in r.headers["access-control-allow-methods"]


def test_other_localhost_ports_and_hosts_are_rejected():
    with _client() as c:
        for origin in ("http://localhost:5174", "http://localhost:8080", "http://evil.example", "null"):
            r = c.get("/api/v1/health", headers={"Origin": origin})
            assert "access-control-allow-origin" not in r.headers


def test_credentials_are_not_allowed():
    """Bearer tokens only: the API must never opt in to credentialed (cookie) cross-origin requests."""
    with _client() as c:
        r = c.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
        assert "access-control-allow-credentials" not in r.headers


def test_wildcard_still_rejected_for_vite_setup():
    import pytest

    with pytest.raises(ValueError):
        Settings(_env_file=None, environment="testing", cors_origins="*", database_url="sqlite://", jwt_secret_key="x" * 80)
