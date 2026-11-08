"""Shared FastAPI dependencies."""

from fastapi import Request

from app.core.config import Settings


def get_app_settings(request: Request) -> Settings:
    """Return the settings bound to the running application instance."""
    return request.app.state.settings
