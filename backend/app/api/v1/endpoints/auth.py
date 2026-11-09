from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.core.security import create_access_token
from app.core.security_logging import log_auth_failure, log_security_event
from app.db.session import get_db
from app.schemas.user import Token, UserCreate, UserLogin, UserRead
from app.services import users as user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Register a user account")
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> UserRead:
    """Always creates a regular ``user``. Administrators are created out-of-band (see README)."""
    try:
        user = user_service.create_user(db, payload.username, payload.password)
    except user_service.UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username is already registered") from None
    log_security_event("user_registered", request, user_id=user.id)
    return user


@router.post("/login", response_model=Token, summary="Exchange credentials for a JWT access token")
def login(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> Token:
    user, reason = user_service.authenticate_user(db, payload.username, payload.password)
    if user is None:
        log_auth_failure("login", reason, request, username=payload.username)
        # Identical response for unknown user, wrong password and disabled account.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid username or password", headers={"WWW-Authenticate": "Bearer"}
        )
    token, expires_in = create_access_token(str(user.id), settings)
    log_security_event("login_success", request, user_id=user.id)
    return Token(access_token=token, expires_in=expires_in)
