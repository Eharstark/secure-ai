"""Security event logging (authentication and authorization failures).

Rules: never log passwords, tokens or full API keys. User-supplied values are sanitized and
truncated so they cannot forge log lines (log injection).
"""

import logging
import re

from fastapi import Request

security_logger = logging.getLogger("secureai.security")

_UNSAFE = re.compile(r"[^\x20-\x7e]")


def _clean(value: object | None, max_len: int = 64) -> str | None:
    if value is None:
        return None
    return _UNSAFE.sub("?", str(value))[:max_len]


def _client_ip(request: Request | None) -> str:
    if request is None or request.client is None:
        return "unknown"
    return request.client.host  # X-Forwarded-For is deliberately not trusted here


def log_auth_failure(
    event: str,
    reason: str,
    request: Request | None = None,
    *,
    username: str | None = None,
    key_prefix: str | None = None,
    user_id: int | None = None,
) -> None:
    security_logger.warning(
        "auth_failure event=%s reason=%s ip=%s method=%s path=%s username=%r key_prefix=%r user_id=%s",
        event,
        reason,
        _client_ip(request),
        request.method if request else "-",
        _clean(request.url.path, 128) if request else "-",
        _clean(username),
        _clean(key_prefix, 16),
        user_id,
    )


def log_authz_failure(
    reason: str, request: Request, *, user_id: int, method: str, required: str
) -> None:
    security_logger.warning(
        "authz_failure reason=%s ip=%s method=%s path=%s user_id=%s auth_method=%s required=%s",
        reason,
        _client_ip(request),
        request.method,
        _clean(request.url.path, 128),
        user_id,
        method,
        required,
    )


def log_security_event(event: str, request: Request | None = None, **fields: object) -> None:
    extras = " ".join(f"{k}={_clean(v)!r}" for k, v in fields.items())
    security_logger.info("security_event event=%s ip=%s %s", event, _client_ip(request), extras)
