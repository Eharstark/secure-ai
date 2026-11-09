from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.api_key import ApiKey


class ApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    expires_in_days: int | None = Field(default=None, ge=1, le=365, description="Omit for a key that never expires")


class ApiKeyRead(BaseModel):
    """Public view of an API key. Contains neither the key nor its hash."""

    id: int
    name: str
    prefix: str
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked: bool

    @classmethod
    def from_model(cls, key: ApiKey) -> Self:
        return cls(
            id=key.id,
            name=key.name,
            prefix=key.prefix,
            created_at=key.created_at,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            revoked=key.revoked_at is not None,
        )


class ApiKeyCreated(ApiKeyRead):
    api_key: str = Field(description="The full key. Shown ONLY once; store it securely.")
