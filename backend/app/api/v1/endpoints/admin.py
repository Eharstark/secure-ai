from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import Principal, require_admin
from app.core.security_logging import log_security_event
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import AdminUserUpdate, UserRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserRead], summary="List users (admin)")
def list_users(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Principal = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id).limit(limit).offset(offset)))


@router.patch("/users/{user_id}", response_model=UserRead, summary="Change a user's role or status (admin)")
def update_user(
    payload: AdminUserUpdate,
    request: Request,
    user_id: int = Path(ge=1),
    principal: Principal = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    if user_id == principal.user.id:
        # Prevents an administrator from locking everyone out by demoting or disabling themselves.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot change your own role or status")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    log_security_event(
        "user_updated", request, admin_id=principal.user.id, target_id=user.id, role=user.role.value, is_active=user.is_active
    )
    return user
