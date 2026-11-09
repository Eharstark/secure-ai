import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.conftest import make_settings


def test_cors_origins_are_parsed_and_trimmed():
    s = make_settings(cors_origins=" http://a.test , https://b.test ,, ")
    assert s.cors_origin_list == ["http://a.test", "https://b.test"]


def test_empty_cors_origins_gives_empty_list():
    assert make_settings(cors_origins="").cors_origin_list == []


@pytest.mark.parametrize("env", ["development", "testing", "production"])
def test_wildcard_cors_rejected(env):
    with pytest.raises(ValidationError):
        make_settings(environment=env, cors_origins="*")


def test_production_requires_https_origins():
    with pytest.raises(ValidationError):
        make_settings(environment="production", cors_origins="http://app.example.com")


def test_invalid_origin_scheme_rejected():
    with pytest.raises(ValidationError):
        make_settings(cors_origins="ftp://example.com")


def test_settings_read_from_environment(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "e" * 64)
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    s = Settings(_env_file=None)
    assert s.log_level == "DEBUG"
    assert s.environment == "testing"


# ---- JWT / authentication settings --------------------------------------------------------


def test_jwt_secret_is_required():
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY is required"):
        make_settings(jwt_secret_key=None)


def test_empty_jwt_secret_is_rejected():
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY is required"):
        make_settings(jwt_secret_key="")


def test_short_jwt_secret_is_rejected():
    with pytest.raises(ValidationError, match="at least 32"):
        make_settings(jwt_secret_key="short")


def test_secret_length_depends_on_algorithm():
    with pytest.raises(ValidationError, match="at least 64"):
        make_settings(jwt_algorithm="HS512", jwt_secret_key="a" * 40)
    assert make_settings(jwt_algorithm="HS512", jwt_secret_key="a" * 64).jwt_algorithm == "HS512"


@pytest.mark.parametrize("secret", ["change-me-" + "x" * 40, "your-secret-" + "x" * 40, "secret" + "x" * 40])
def test_placeholder_jwt_secret_is_rejected(secret):
    with pytest.raises(ValidationError, match="placeholder"):
        make_settings(jwt_secret_key=secret)


def test_unsupported_jwt_algorithm_is_rejected():
    with pytest.raises(ValidationError):
        make_settings(jwt_algorithm="none")
    with pytest.raises(ValidationError):
        make_settings(jwt_algorithm="RS256")


@pytest.mark.parametrize("minutes", [0, -5, 1441])
def test_token_lifetime_bounds(minutes):
    with pytest.raises(ValidationError):
        make_settings(jwt_access_token_expire_minutes=minutes)


def test_jwt_secret_is_not_exposed_in_repr():
    s = make_settings()
    assert s.jwt_secret not in repr(s)
    assert s.jwt_secret not in str(s)
