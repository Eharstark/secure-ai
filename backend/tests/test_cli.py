import pytest
from sqlalchemy import select

from app import cli
from app.db.base import Base
from app.db.session import build_engine, build_session_factory
from app.models.user import Role, User
from tests.conftest import make_settings
from tests.helpers import STRONG_PASSWORD


@pytest.fixture
def cli_db(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'cli.db'}"
    engine = build_engine(url)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(cli, "get_settings", lambda: make_settings(database_url=url))
    yield build_session_factory(engine)
    engine.dispose()


def _prompt(monkeypatch, *answers):
    values = iter(answers)
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt="": next(values))


def test_create_admin(cli_db, monkeypatch, capsys):
    _prompt(monkeypatch, STRONG_PASSWORD, STRONG_PASSWORD)
    assert cli.main(["create-admin", "Boss"]) == 0
    with cli_db() as db:
        user = db.scalar(select(User).where(User.username == "boss"))
    assert user.role == Role.ADMIN and user.password_hash.startswith("$argon2id$")
    assert STRONG_PASSWORD not in capsys.readouterr().out


def test_create_admin_rejects_weak_password(cli_db, monkeypatch, capsys):
    _prompt(monkeypatch, "short", "short")
    assert cli.main(["create-admin", "boss"]) == 2
    assert "short" not in capsys.readouterr().err.replace("too short", "")


def test_create_admin_password_mismatch(cli_db, monkeypatch):
    _prompt(monkeypatch, STRONG_PASSWORD, STRONG_PASSWORD + "x")
    assert cli.main(["create-admin", "boss"]) == 2


def test_create_admin_does_not_touch_existing_user(cli_db, monkeypatch):
    _prompt(monkeypatch, STRONG_PASSWORD, STRONG_PASSWORD, STRONG_PASSWORD, STRONG_PASSWORD)
    assert cli.main(["create-admin", "boss"]) == 0
    assert cli.main(["create-admin", "boss"]) == 1
