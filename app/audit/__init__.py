"""
Tamper-evident audit chain.

Every write-side action calls `log(...)`. Each event records `prev_hash` =
the previous event's `hash`, and its own `hash = sha256(prev_hash || canonical_json)`.
Walking the table forward and recomputing hashes lets the CAG / RTI auditor
prove no event was inserted, deleted or modified silently.

This module deliberately swallows its own errors — auditing must never block
or roll back the user's transaction. Failures are logged and surface in the
audit health endpoint.
"""

import hashlib
import json
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
import psycopg2.extras

from ..config import DATABASE_URL

logger = logging.getLogger(__name__)

# Per-request correlation id; populated by the Request middleware.
_request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> Optional[str]:
    return _request_id_var.get()


def _canonical(payload: dict[str, Any]) -> str:
    """Stable JSON serialisation used as the hash input."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _compute_hash(prev_hash: Optional[str], canonical: str) -> str:
    src = (prev_hash or "") + canonical
    return hashlib.sha256(src.encode("utf-8")).hexdigest()


def log(
    *,
    actor,                          # CurrentUser | None  — kept untyped to avoid circular import
    action: str,
    target_type: str,
    target_id: Optional[str],
    detail: Optional[dict] = None,
    actor_role: Optional[str] = None,
    actor_label: Optional[str] = None,
) -> Optional[str]:
    """Insert one audit event. Returns the new event id, or None on failure.

    `actor` is duck-typed: anything with `.id`, `.role`, `.name` works
    (i.e. `app.auth.CurrentUser`). When `actor` is None we fall back to
    the explicit `actor_role` / `actor_label` arguments (use "system" /
    "System" for backend-initiated work).
    """
    role = actor_role or (getattr(actor, "role", None) if actor else None) or "system"
    label = actor_label or (getattr(actor, "name", None) if actor else None) or "System"
    actor_id = getattr(actor, "id", None) if actor else None

    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {
        "ts": timestamp,
        "actor_id": str(actor_id) if actor_id else None,
        "role": role,
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id) if target_id else None,
        "detail": detail or {},
    }
    canonical = _canonical(payload)

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute("SELECT hash FROM audit_events ORDER BY timestamp DESC, hash DESC LIMIT 1")
            prev = cur.fetchone()
            prev_hash = prev[0] if prev else None
            new_hash = _compute_hash(prev_hash, canonical)
            new_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO audit_events
                    (id, timestamp, actor_id, actor_role, actor_label,
                     action, target_type, target_id, detail, request_id,
                     prev_hash, hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    new_id, timestamp, actor_id, role, label,
                    action, target_type, target_id,
                    psycopg2.extras.Json(detail or {}),
                    get_request_id(),
                    prev_hash, new_hash,
                ),
            )
            conn.commit()
        return new_id
    except Exception as e:
        logger.exception(f"audit.log failed for action={action}: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return None
    finally:
        if conn:
            conn.close()


def head_hash() -> Optional[str]:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT hash FROM audit_events ORDER BY timestamp DESC, hash DESC LIMIT 1")
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def verify_chain(limit: int = 10_000) -> dict:
    """Walk the chain in chronological order; report first break or OK."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT id, timestamp, actor_id, actor_role, action, target_type, "
                "target_id, detail, prev_hash, hash "
                "FROM audit_events ORDER BY timestamp ASC, hash ASC LIMIT %s",
                (limit,),
            )
            prev_hash = None
            count = 0
            for row in cur:
                payload = {
                    "ts": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
                    "actor_id": str(row["actor_id"]) if row["actor_id"] else None,
                    "role": row["actor_role"],
                    "action": row["action"],
                    "target_type": row["target_type"],
                    "target_id": str(row["target_id"]) if row["target_id"] else None,
                    "detail": row["detail"] or {},
                }
                expected = _compute_hash(prev_hash, _canonical(payload))
                if row["prev_hash"] != prev_hash or row["hash"] != expected:
                    return {"ok": False, "broken_at": str(row["id"]), "count": count}
                prev_hash = row["hash"]
                count += 1
            return {"ok": True, "last_hash": prev_hash, "count": count}
    finally:
        conn.close()
