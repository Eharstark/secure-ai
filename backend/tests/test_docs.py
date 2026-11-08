from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import make_settings


def test_docs_available_in_development():
    with TestClient(create_app(make_settings(environment="development"))) as c:
        assert c.get("/docs").status_code == 200
        assert c.get("/openapi.json").status_code == 200


def test_docs_can_be_disabled_by_config():
    with TestClient(create_app(make_settings(enable_docs=False))) as c:
        assert c.get("/docs").status_code == 404
        assert c.get("/redoc").status_code == 404
        assert c.get("/openapi.json").status_code == 404


def test_docs_always_disabled_in_production():
    settings = make_settings(
        environment="production", enable_docs=True, cors_origins="https://app.example.com"
    )
    with TestClient(create_app(settings)) as c:
        assert c.get("/docs").status_code == 404
        assert c.get("/openapi.json").status_code == 404
