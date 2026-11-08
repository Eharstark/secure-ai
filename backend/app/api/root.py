from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.root import RootResponse

router = APIRouter(tags=["root"])


@router.get("/", response_model=RootResponse, summary="API identification")
def read_root(settings: Settings = Depends(get_app_settings)) -> RootResponse:
    return RootResponse(name=settings.app_name, message="SecureAI Gateway API is running.")
