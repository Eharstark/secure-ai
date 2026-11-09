import os

# Must be set BEFORE importing the application: ``app.main`` builds a module-level app from the environment.
TEST_JWT_SECRET = "test-only-jwt-secret-" + "k" * 64
os.environ["JWT_SECRET_KEY"] = TEST_JWT_SECRET
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory; never touch a real database file in tests

import logging  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import Settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import create_app  # noqa: E402
from tests import helpers  # noqa: E402


def make_settings(**overrides) -> Settings:
    """Build isolated settings that ignore the real environment and .env file."""
    values = {
        "environment": "testing",
        "enable_docs": True,
        "cors_origins": "http://localhost:3000",
        "app_version": "9.9.9-test",
        "database_url": "sqlite://",
        "jwt_secret_key": TEST_JWT_SECRET,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as c:
        Base.metadata.create_all(app.state.engine)
        yield c


@pytest.fixture
def user_headers(client):
    helpers.register(client, "alice")
    return helpers.bearer(helpers.login(client, "alice"))


@pytest.fixture
def admin_headers(client):
    helpers.register(client, "root-admin")
    helpers.set_role(client, "root-admin", "admin")
    return helpers.bearer(helpers.login(client, "root-admin"))


@pytest.fixture
def security_log():
    """Capture records from the security logger regardless of global logging configuration."""

    class _Capture(logging.Handler):
        def __init__(self):
            super().__init__(logging.DEBUG)
            self.records: list[logging.LogRecord] = []

        def emit(self, record):
            self.records.append(record)

        @property
        def text(self) -> str:
            return "\n".join(r.getMessage() for r in self.records)

    handler = _Capture()
    logger = logging.getLogger("secureai.security")
    previous = logger.level
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    yield handler
    logger.removeHandler(handler)
    logger.setLevel(previous)
