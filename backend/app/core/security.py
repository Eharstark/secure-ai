"""Cryptographic primitives: password hashing, JWT handling and API key generation.

- Passwords: Argon2id via argon2-cffi (salted, memory-hard). Plaintext is never stored.
- JWT: PyJWT with an explicit algorithm allow-list and required claims.
- API keys: 256-bit random secrets from ``secrets``; only a SHA-256 digest is persisted.
  SHA-256 is appropriate here (not for passwords) because the key itself is high-entropy random data.
"""

import hashlib
import hmac
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import Settings

# ----------------------------------------------------------------------------- passwords

_hasher = PasswordHasher()  # argon2id with the library's current recommended parameters


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):  # VerifyMismatchError is a VerificationError
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


@lru_cache
def _dummy_hash() -> str:
    return hash_password(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    """Spend the same time as a real verification (used when the user does not exist)."""
    verify_password(_dummy_hash(), password)


# ----------------------------------------------------------------------------------- JWT


class TokenError(Exception):
    """Invalid access token. ``reason`` is a short machine-readable code safe to log."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class TokenExpiredError(TokenError):
    def __init__(self) -> None:
        super().__init__("token_expired")


def create_access_token(
    subject: str,
    settings: Settings,
    *,
    now: datetime | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, int]:
    """Return ``(token, expires_in_seconds)``."""
    issued_at = now or datetime.now(UTC)
    lifetime = expires_delta if expires_delta is not None else timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    claims = {
        "sub": subject,
        "iss": settings.jwt_issuer,
        "iat": issued_at,
        "exp": issued_at + lifetime,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],  # allow-list; "none" and algorithm confusion are rejected
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError() from exc
    except jwt.InvalidSignatureError as exc:
        raise TokenError("bad_signature") from exc
    except jwt.InvalidAlgorithmError as exc:
        raise TokenError("bad_algorithm") from exc
    except jwt.DecodeError as exc:
        raise TokenError("malformed_token") from exc
    except jwt.PyJWTError as exc:  # missing/invalid claims, wrong issuer, immature token, ...
        raise TokenError("invalid_claims") from exc


# -------------------------------------------------------------------------------- API keys

API_KEY_TAG = "sagw"
_API_KEY_RE = re.compile(rf"^{API_KEY_TAG}_([0-9a-f]{{8}})_([A-Za-z0-9_-]{{43}})$")


def generate_api_key() -> tuple[str, str, str]:
    """Return ``(plaintext_key, prefix, sha256_hex_digest)``. The plaintext must be shown only once."""
    prefix = secrets.token_hex(4)
    secret = secrets.token_urlsafe(32)  # 256 bits of entropy, 43 URL-safe characters
    key = f"{API_KEY_TAG}_{prefix}_{secret}"
    return key, prefix, hash_api_key(key)


def parse_api_key_prefix(raw_key: str) -> str | None:
    """Strictly validate the key format; return its public prefix or ``None`` if malformed."""
    match = _API_KEY_RE.fullmatch(raw_key)
    return match.group(1) if match else None


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def api_key_matches(raw_key: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(raw_key), stored_hash)
