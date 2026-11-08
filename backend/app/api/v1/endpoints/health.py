from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Application health")
def health_check(settings: Settings = Depends(get_app_settings)) -> HealthResponse:
    """Liveness check. Returns only status, version and time; no infrastructure details."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc),
    )
