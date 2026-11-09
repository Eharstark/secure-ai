"""Application factory and entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.root import router as root_router
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db.session import build_engine, build_session_factory
from app.core.rate_limit import RateLimitMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    logger.info(
        "Starting %s v%s (environment=%s, docs_enabled=%s)",
        settings.app_name,
        settings.app_version,
        settings.environment,
        settings.docs_enabled,
    )
    yield
    app.state.engine.dispose()
    logger.info("Shutting down %s", settings.app_name)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    docs = settings.docs_enabled
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = build_engine(settings.database_url)  # lazy: connects on first use
    app.state.session_factory = build_session_factory(app.state.engine)
    app.add_middleware(RateLimitMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    register_exception_handlers(app)
    app.include_router(root_router)
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
