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
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("ENVIRONMENT", "testing")
    s = Settings(_env_file=None)
    assert s.log_level == "DEBUG"
    assert s.environment == "testing"
