"""Shared FastAPI dependencies: settings and authentication / authorization."""

from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import TokenError, TokenExpiredError, decode_access_token
from app.core.security_logging import log_auth_failure, log_authz_failure
from app.db.session import get_db
from app.models.user import Role, User
from app.services import api_keys as api_key_service
from app.services import users as user_service


def get_app_settings(request: Request) -> Settings:
    """Return the settings bound to the running application instance."""
    return request.app.state.settings


# auto_error=False: we produce our own 401 responses (and log every failure).
bearer_scheme = HTTPBearer(auto_error=False, description="JWT from POST /api/v1/auth/login")
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False, description="API key from POST /api/v1/api-keys")


@dataclass(frozen=True)
class Principal:
    user: User
    method: Literal["jwt", "api_key"]
    api_key_id: int | None = None


def _unauthorized(detail: str = "Invalid authentication credentials") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def _authenticate_jwt(request: Request, token: str, db: Session, settings: Settings) -> Principal:
    try:
        claims = decode_access_token(token, settings)
    except TokenExpiredError:
        log_auth_failure("jwt", "token_expired", request)
        raise _unauthorized("Token has expired") from None
    except TokenError as exc:
        log_auth_failure("jwt", exc.reason, request)
        raise _unauthorized() from None

    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError):
        log_auth_failure("jwt", "invalid_subject", request)
        raise _unauthorized() from None

    # Role and status always come from the database, never from the token, so demotion or
    # deactivation takes effect immediately.
    user = user_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        log_auth_failure("jwt", "user_not_found_or_inactive", request, user_id=user_id)
        raise _unauthorized()
    return Principal(user=user, method="jwt")


def _authenticate_api_key(request: Request, raw_key: str, db: Session) -> Principal:
    result = api_key_service.authenticate_api_key(db, raw_key)
    if result.user is None or result.api_key is None:
        log_auth_failure("api_key", result.reason, request, key_prefix=result.prefix)
        raise _unauthorized()
    return Principal(user=result.user, method="api_key", api_key_id=result.api_key.id)


def get_current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    api_key: str | None = Depends(api_key_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> Principal:
    """Authenticate via ``Authorization: Bearer <jwt>`` or ``X-API-Key``. A bearer token takes precedence."""
    if credentials is not None:
        return _authenticate_jwt(request, credentials.credentials, db, settings)
    if api_key is not None:
        return _authenticate_api_key(request, api_key, db)
    log_auth_failure("authenticate", "missing_credentials", request)
    raise _unauthorized("Authentication required")


def require_roles(*roles: Role, session_only: bool = False):
    """Build a dependency allowing only the given roles.

    ``session_only`` additionally requires a JWT session (API keys are refused), used for
    credential management and administration.
    """

    required = "/".join(r.value for r in roles) + (" (session)" if session_only else "")

    def dependency(request: Request, principal: Principal = Depends(get_current_principal)) -> Principal:
        if session_only and principal.method != "jwt":
            log_authz_failure("session_required", request, user_id=principal.user.id, method=principal.method, required=required)
            raise HTTPException(status.HTTP_403_FORBIDDEN, "A user session token is required for this endpoint")
        if principal.user.role not in roles:
            log_authz_failure("insufficient_role", request, user_id=principal.user.id, method=principal.method, required=required)
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return principal

    return dependency


require_authenticated = get_current_principal
require_session = require_roles(Role.USER, Role.ADMIN, session_only=True)
require_admin = require_roles(Role.ADMIN, session_only=True)
