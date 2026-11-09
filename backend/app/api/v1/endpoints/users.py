from fastapi import APIRouter, Depends

from app.api.deps import Principal, require_authenticated
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead, summary="Current user (JWT or API key)")
def read_me(principal: Principal = Depends(require_authenticated)) -> UserRead:
    return UserRead.model_validate(principal.user)
