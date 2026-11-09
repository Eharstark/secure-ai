from contextlib import contextmanager
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings
from app.db import session as session_module
from app.db.base import Base

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def migrated_db(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    session_module.get_engine.cache_clear()
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    yield cfg, url
    if session_module.get_engine.cache_info().currsize:
        session_module.get_engine().dispose()  # close pooled SQLite connections used by Alembic
    get_settings.cache_clear()
    session_module.get_engine.cache_clear()


@contextmanager
def _engine(url):
    engine = create_engine(url)
    try:
        yield engine
    finally:
        engine.dispose()


def test_upgrade_creates_expected_schema(migrated_db):
    cfg, url = migrated_db
    command.upgrade(cfg, "head")
    with _engine(url) as engine:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        key_cols = {c["name"] for c in inspector.get_columns("api_keys")}
        unique_indexes = {i["name"] for i in inspector.get_indexes("users") + inspector.get_indexes("api_keys") if i["unique"]}
    assert {"users", "api_keys"} <= tables
    assert {"id", "username", "password_hash", "role", "is_active", "created_at", "last_login_at"} <= user_cols
    assert {"id", "user_id", "name", "prefix", "key_hash", "created_at", "expires_at", "last_used_at", "revoked_at"} <= key_cols
    # No plaintext key column exists.
    assert "api_key" not in key_cols and "key" not in key_cols
    assert {"ix_users_username", "ix_api_keys_prefix"} <= unique_indexes


def test_migration_matches_models_no_drift(migrated_db):
    cfg, url = migrated_db
    command.upgrade(cfg, "head")
    with _engine(url) as engine, engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []


def test_downgrade_removes_tables(migrated_db):
    cfg, url = migrated_db
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    with _engine(url) as engine:
        tables = set(inspect(engine).get_table_names())
    assert "users" not in tables and "api_keys" not in tables
