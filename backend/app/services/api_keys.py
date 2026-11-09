"""API key lifecycle and verification. Only SHA-256 digests are stored."""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import api_key_matches, generate_api_key, parse_api_key_prefix
from app.db.types import utcnow
from app.models.api_key import ApiKey
from app.models.user import User

MAX_ACTIVE_KEYS_PER_USER = 10
_LAST_USED_RESOLUTION = timedelta(seconds=60)  # avoid a database write on every request


class TooManyKeysError(Exception):
    pass


@dataclass(frozen=True)
class ApiKeyAuthResult:
    api_key: ApiKey | None
    user: User | None
    reason: str  # "ok" | "malformed" | "unknown_key" | "revoked" | "expired" | "owner_inactive"
    prefix: str | None = None


def _is_active(key: ApiKey) -> bool:
    now = utcnow()
    return key.revoked_at is None and (key.expires_at is None or key.expires_at > now)


def create_api_key(db: Session, user: User, name: str, expires_in_days: int | None) -> tuple[ApiKey, str]:
    active = [k for k in list_api_keys(db, user.id) if _is_active(k)]
    if len(active) >= MAX_ACTIVE_KEYS_PER_USER:
        raise TooManyKeysError()
    raw_key, prefix, key_hash = generate_api_key()
    key = ApiKey(
        user_id=user.id,
        name=name,
        prefix=prefix,
        key_hash=key_hash,
        expires_at=utcnow() + timedelta(days=expires_in_days) if expires_in_days else None,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return key, raw_key


def list_api_keys(db: Session, user_id: int) -> list[ApiKey]:
    return list(db.scalars(select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.id)))


def get_api_key(db: Session, key_id: int) -> ApiKey | None:
    return db.get(ApiKey, key_id)


def revoke_api_key(db: Session, key: ApiKey) -> None:
    if key.revoked_at is None:
        key.revoked_at = utcnow()
        db.commit()


def authenticate_api_key(db: Session, raw_key: str) -> ApiKeyAuthResult:
    prefix = parse_api_key_prefix(raw_key)
    if prefix is None:
        return ApiKeyAuthResult(None, None, "malformed")
    key = db.scalar(select(ApiKey).where(ApiKey.prefix == prefix))
    if key is None or not api_key_matches(raw_key, key.key_hash):
        return ApiKeyAuthResult(None, None, "unknown_key", prefix)
    if key.revoked_at is not None:
        return ApiKeyAuthResult(None, None, "revoked", prefix)
    if key.expires_at is not None and key.expires_at <= utcnow():
        return ApiKeyAuthResult(None, None, "expired", prefix)
    user = key.user
    if not user.is_active:
        return ApiKeyAuthResult(None, None, "owner_inactive", prefix)
    now = utcnow()
    if key.last_used_at is None or now - key.last_used_at > _LAST_USED_RESOLUTION:
        key.last_used_at = now
        db.commit()
    return ApiKeyAuthResult(key, user, "ok", prefix)
