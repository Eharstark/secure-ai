"""Centralized exception handlers returning a consistent JSON error shape."""

import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.error import ErrorResponse, ValidationIssue

logger = logging.getLogger(__name__)


def _phrase(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    body = ErrorResponse(error=_phrase(exc.status_code), message=str(exc.detail))
    return JSONResponse(
        status_code=exc.status_code,
        content=body.model_dump(exclude_none=True),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Only location and message are returned; submitted input values are never echoed back.
    issues = [ValidationIssue(loc=[str(p) for p in e["loc"]], msg=e["msg"]) for e in exc.errors()]
    body = ErrorResponse(error=_phrase(422), message="Request validation failed.", details=issues)
    return JSONResponse(status_code=422, content=body.model_dump(exclude_none=True))


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Full traceback goes to the server log only; the client gets a generic message.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    body = ErrorResponse(error=_phrase(500), message="An internal error occurred.")
    return JSONResponse(status_code=500, content=body.model_dump(exclude_none=True))


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
