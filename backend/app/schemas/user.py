from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.user import Role

# Usernames are normalized to lowercase, so "Alice" and "alice" are the same account.
Username = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$"),
]


class UserCreate(BaseModel):
    """Self-registration payload. Unknown fields (e.g. ``role``) are rejected, so users cannot self-assign roles."""

    model_config = ConfigDict(extra="forbid")

    username: Username
    password: Annotated[str, StringConstraints(min_length=12, max_length=128)]

    @model_validator(mode="after")
    def _password_policy(self) -> Self:
        if self.username in self.password.lower():
            raise ValueError("Password must not contain the username.")
        if len(set(self.password)) < 5:
            raise ValueError("Password is too repetitive.")
        return self


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=64)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class UserRead(BaseModel):
    """Public view of a user. Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: Role
    is_active: bool
    created_at: datetime


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one(self) -> Self:
        if self.role is None and self.is_active is None:
            raise ValueError("Provide at least one of: role, is_active.")
        return self


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds")
