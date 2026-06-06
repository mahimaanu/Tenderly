"""
Tenderly FastAPI application entrypoint.

Adds (vs the original):
- env-driven CORS origins (no more allow_origins=["*"])
- a tiny request-id middleware so every audit event ties back to an HTTP request
- a consistent JSON error envelope for HTTPException + uncaught exceptions
- registration of new routers: auth, audit, officer, bidder, notifications
- /health for liveness checks
"""

import logging
import os
import sys
import uuid

# Load .env from repo root before anything else reads os.environ
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except ImportError:
    pass  # python-dotenv not installed — rely on shell env

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Allow root-level imports (legacy modules at repo root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api import audit as audit_api
from app.api import auth as auth_api
from app.api import bidder as bidder_api
from app.api import bidders, evaluations, notifications, officer as officer_api, reports, tenders
from app.audit import set_request_id
from app.config import ALLOWED_ORIGINS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Tenderly API",
    description=(
        "AI-assisted tender evaluation and eligibility analysis. "
        "Auditable, explainable, end-to-end."
    ),
    version="1.0.0",
    openapi_tags=[
        {"name": "auth", "description": "Login, registration, JWT helpers."},
        {"name": "tenders"},
        {"name": "bidders"},
        {"name": "evaluations"},
        {"name": "reports"},
        {"name": "audit", "description": "Tamper-evident hash chain."},
        {"name": "officer", "description": "Officer-only convenience endpoints."},
        {"name": "bidder", "description": "Bidder-only self-serve endpoints."},
        {"name": "notifications"},
    ],
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization", "Content-Type", "If-Match", "Idempotency-Key",
        "X-Request-Id", "Accept",
    ],
    expose_headers=["ETag", "X-Request-Id"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    set_request_id(rid)
    response = await call_next(request)
    response.headers["X-Request-Id"] = rid
    return response


# ---------------------------------------------------------------------------
# Error envelope — consistent shape regardless of source
# ---------------------------------------------------------------------------


def _envelope(code: str, message: str, **extra) -> dict:
    err = {"code": code, "message": message}
    err.update(extra)
    return {"error": err}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)
    code = {
        400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
        404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_FAILED",
    }.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(code, str(detail) if detail else "Request failed"),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_envelope("VALIDATION_FAILED", "Request validation failed.", errors=exc.errors()),
    )


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=_envelope("INTERNAL_ERROR", "An unexpected error occurred."),
    )


# ---------------------------------------------------------------------------
# Routers — both legacy /api/tenders/* and new /api/v1/* are registered.
# Frontend should target /api/v1/* going forward.
# ---------------------------------------------------------------------------

# Legacy mount — keeps anything currently calling /api/tenders working.
app.include_router(tenders.router, prefix="/api/tenders", tags=["tenders"])
app.include_router(bidders.router, prefix="/api/tenders", tags=["bidders"])
app.include_router(evaluations.router, prefix="/api/tenders", tags=["evaluations"])
app.include_router(reports.router, prefix="/api/tenders", tags=["reports"])

# v1 mount
app.include_router(auth_api.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tenders.router, prefix="/api/v1/tenders", tags=["tenders"])
app.include_router(bidders.router, prefix="/api/v1/tenders", tags=["bidders"])
app.include_router(evaluations.router, prefix="/api/v1/tenders", tags=["evaluations"])
app.include_router(reports.router, prefix="/api/v1/tenders", tags=["reports"])
app.include_router(audit_api.router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(officer_api.router, prefix="/api/v1/officer", tags=["officer"])
app.include_router(bidder_api.router, prefix="/api/v1/bidder", tags=["bidder"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Liveness
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"])
async def health():
    """Cheap liveness probe — also pings the DB to surface configuration issues."""
    db_ok = False
    try:
        from app.db import get_conn
        c = get_conn()
        try:
            with c.cursor() as cur:
                cur.execute("SELECT 1")
                db_ok = cur.fetchone()[0] == 1
        finally:
            c.close()
    except Exception as e:
        logger.warning("Health check DB ping failed: %s", e)
    return {"status": "ok", "db": "ok" if db_ok else "down", "version": "1.0.0"}


@app.get("/", tags=["system"])
async def root():
    return {
        "service": "Tenderly API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
    }
