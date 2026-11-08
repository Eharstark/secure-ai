from pydantic import BaseModel


class ValidationIssue(BaseModel):
    loc: list[str]
    msg: str


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: list[ValidationIssue] | None = None
