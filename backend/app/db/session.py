"""Database engine and session factory.

Engines are created lazily: nothing connects until a session is used. Swapping SQLite for
PostgreSQL later only requires changing DATABASE_URL (and adding a driver dependency).
"""

from collections.abc import Generator
from functools import lru_cache
from pathlib import Path

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


def build_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    kwargs: dict = {"pool_pre_ping": True}
    if url.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
        if url.database in (None, "", ":memory:"):
            # One shared connection so an in-memory database is visible across threads (tests).
            kwargs["poolclass"] = StaticPool
        else:
            Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, **kwargs)

    if url.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record) -> None:  # pragma: no cover - trivial
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@lru_cache
def get_engine() -> Engine:
    """Process-wide engine from application settings (used by Alembic and the CLI)."""
    return build_engine(get_settings().database_url)


def get_db(request: Request) -> Generator[Session, None, None]:
    """FastAPI dependency yielding a session bound to the running app's engine."""
    db = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()
