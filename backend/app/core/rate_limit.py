
"""In-memory per-IP rate limiting middleware."""

import json
import time
from collections import defaultdict, deque
from threading import Lock

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.security_logging import log_security_event


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app
        self.requests = defaultdict(deque)
        self.lock = Lock()

        self.window_seconds = 60
        self.auth_limit = 10
        self.api_limit = 120

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")

        # Skip CORS preflight and non-API routes.
        if method == "OPTIONS" or not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        ip = client[0] if client else "unknown"

        # Apply stricter limits to authentication endpoints.
        is_auth_endpoint = path in {
            "/api/v1/auth/login",
            "/api/v1/auth/register",
        }

        limit = self.auth_limit if is_auth_endpoint else self.api_limit
        now = time.monotonic()
        key = (ip, "auth" if is_auth_endpoint else "api")

        retry_after = None

        # Update request history safely.
        with self.lock:
            timestamps = self.requests[key]

            while timestamps and now - timestamps[0] >= self.window_seconds:
                timestamps.popleft()

            if len(timestamps) >= limit:
                retry_after = max(
                    1,
                    int(self.window_seconds - (now - timestamps[0])),
                )
            else:
                timestamps.append(now)

        # Log and reject requests exceeding the limit.
        if retry_after is not None:
            log_security_event(
                "rate_limit_exceeded",
                Request(scope),
                limit=limit,
                window_seconds=self.window_seconds,
                path=path,
                method=method,
            )

            body = json.dumps({
                "detail": "Too many requests. Please try again later."
            }).encode()

            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"retry-after", str(retry_after).encode()),
                ],
            })

            await send({
                "type": "http.response.body",
                "body": body,
            })
            return

        await self.app(scope, receive, send)
