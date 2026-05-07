"""
Centralised env-driven config for the Tenderly backend.
Importing this module triggers a single read of os.environ so behaviour is
deterministic per process.
"""

import os


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# Database
DATABASE_URL: str = _get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in your "
        "Postgres connection string, or export DATABASE_URL in your shell."
    )

# Auth
JWT_SECRET: str = _get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM: str = _get("JWT_ALGORITHM", "HS256")
JWT_TTL_HOURS: int = _get_int("JWT_TTL_HOURS", 8)

# CORS
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in _get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3010").split(",")
    if o.strip()
]

# File storage
UPLOADS_DIR: str = _get("UPLOADS_DIR", "uploads")
REPORTS_DIR: str = _get("REPORTS_DIR", "reports")

# Evaluation thresholds
OCR_CONFIDENCE_FLOOR: float = _get_float("OCR_CONFIDENCE_FLOOR", 0.70)
EVAL_CONFIDENCE_FLOOR: float = _get_float("EVAL_CONFIDENCE_FLOOR", 0.75)

# Feature flags
LLM_ENABLED: bool = _get("LLM_ENABLED", "false").lower() in {"1", "true", "yes"}
DOCUMENT_PROCESSING_ENABLED: bool = _get(
    "DOCUMENT_PROCESSING_ENABLED", "true"
).lower() in {"1", "true", "yes"}
