from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import Principal, require_session
from app.core.security_logging import log_security_event
from app.db.session import get_db
from app.models.user import Role
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreated, ApiKeyRead
from app.services import api_keys as service

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED, summary="Create an API key")
def create_api_key(
    payload: ApiKeyCreate,
    request: Request,
    principal: Principal = Depends(require_session),
    db: Session = Depends(get_db),
) -> ApiKeyCreated:
    """The plaintext key is returned once and cannot be retrieved again."""
    try:
        key, raw_key = service.create_api_key(db, principal.user, payload.name, payload.expires_in_days)
    except service.TooManyKeysError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Maximum of {service.MAX_ACTIVE_KEYS_PER_USER} active API keys reached"
        ) from None
    log_security_event("api_key_created", request, user_id=principal.user.id, key_id=key.id)
    return ApiKeyCreated(**ApiKeyRead.from_model(key).model_dump(), api_key=raw_key)


@router.get("", response_model=list[ApiKeyRead], summary="List your API keys")
def list_api_keys(principal: Principal = Depends(require_session), db: Session = Depends(get_db)) -> list[ApiKeyRead]:
    return [ApiKeyRead.from_model(k) for k in service.list_api_keys(db, principal.user.id)]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke an API key")
def revoke_api_key(
    request: Request,
    key_id: int = Path(ge=1),
    principal: Principal = Depends(require_session),
    db: Session = Depends(get_db),
) -> Response:
    key = service.get_api_key(db, key_id)
    # 404 (not 403) for other users' keys so key ids cannot be probed. Admins may revoke any key.
    if key is None or (key.user_id != principal.user.id and principal.user.role != Role.ADMIN):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    service.revoke_api_key(db, key)
    log_security_event("api_key_revoked", request, user_id=principal.user.id, key_id=key.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
