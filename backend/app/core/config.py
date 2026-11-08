"""Application configuration loaded from environment variables.

All values come from the process environment or a repository-root ``.env`` file.
Nothing sensitive is hardcoded here, and settings are never exposed via the API.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> repository root is three levels above this file's folder.
# Inside Docker this path does not exist, which is fine: values come from the environment.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "SecureAI Gateway"
    app_version: str = "0.1.0"
    environment: Literal["development", "testing", "production"] = "development"
    enable_docs: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    # Comma-separated string (kept as str to avoid JSON-parsing quirks of list env vars).
    cors_origins: str = ""
    database_url: str = "sqlite:///./data/secureai.db"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_enabled(self) -> bool:
        """Interactive docs are never served in production."""
        return self.enable_docs and not self.is_production

    @model_validator(mode="after")
    def _validate_cors(self) -> "Settings":
        for origin in self.cors_origin_list:
            if "*" in origin:
                raise ValueError("Wildcard CORS origins are not allowed; list explicit origins.")
            if not origin.startswith(("http://", "https://")):
                raise ValueError(f"Invalid CORS origin (must start with http:// or https://): {origin!r}")
            if self.is_production and not origin.startswith("https://"):
                raise ValueError(f"Production CORS origins must use https://: {origin!r}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
