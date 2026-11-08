import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_settings(**overrides) -> Settings:
    """Build isolated settings that ignore the real environment and .env file."""
    values = {
        "environment": "testing",
        "enable_docs": True,
        "cors_origins": "http://localhost:3000",
        "app_version": "9.9.9-test",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as c:
        yield c
