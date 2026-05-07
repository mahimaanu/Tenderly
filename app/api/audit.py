"""
Audit endpoints — paginated event feed, chain head hash, integrity check.
Officer-only.
"""

import csv
import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from ..audit import head_hash as _head_hash, verify_chain as _verify_chain
from ..auth import CurrentUser, require_officer
from ..db import dict_all, get_conn, with_dict_cursor

router = APIRouter()
logger = logging.getLogger(__name__)


BIDDER_AUTH_ACTIONS = ("auth.login", "auth.logout", "auth.password_changed")

_EXCLUDE_BIDDER_AUTH = (
    "NOT (actor_role = 'bidder' AND action = ANY(%s))"
)


def _query(filters: dict, limit: int, offset: int) -> tuple[str, list]:
    # Always exclude bidder authentication events from the officer audit view
    where = [_EXCLUDE_BIDDER_AUTH]
    params: list = [list(BIDDER_AUTH_ACTIONS)]

    if filters.get("actor_role"):
        where.append("actor_role = %s")
        params.append(filters["actor_role"])
    if filters.get("action"):
        where.append("action ILIKE %s")
        params.append(f"%{filters['action']}%")
    if filters.get("target_type"):
        where.append("target_type = %s")
        params.append(filters["target_type"])
    if filters.get("target_id"):
        where.append("target_id = %s")
        params.append(filters["target_id"])
    if filters.get("from_ts"):
        where.append("timestamp >= %s")
        params.append(filters["from_ts"])
    if filters.get("to_ts"):
        where.append("timestamp <= %s")
        params.append(filters["to_ts"])

    sql = "SELECT * FROM audit_events WHERE " + " AND ".join(where)
    sql += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    return sql, params


@router.get("")
async def list_audit(
    actor_role: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(require_officer),
):
    filters = {
        "actor_role": actor_role, "action": action,
        "target_type": target_type, "target_id": target_id,
        "from_ts": from_ts, "to_ts": to_ts,
    }
    sql, params = _query(filters, page_size, (page - 1) * page_size)

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(sql, params)
            data = dict_all(cur)

            # Total for pagination — apply the same bidder-auth exclusion
            count_where = [_EXCLUDE_BIDDER_AUTH]
            count_params: list = [list(BIDDER_AUTH_ACTIONS)]
            if filters.get("actor_role"):
                count_where.append("actor_role = %s")
                count_params.append(filters["actor_role"])
            count_sql = (
                "SELECT COUNT(*) AS n FROM audit_events WHERE "
                + " AND ".join(count_where)
            )
            cur.execute(count_sql, count_params)
            total = (cur.fetchone() or {}).get("n", 0)

        return {
            "data": data,
            "meta": {"page": page, "page_size": page_size, "total": int(total)},
        }
    finally:
        conn.close()


@router.get("/head-hash")
async def head_hash(user: CurrentUser = Depends(require_officer)):
    h = _head_hash()
    return {"head_hash": h, "short": (h or "")[:8] + "…" + (h or "")[-4:] if h else None}


@router.get("/verify")
async def verify(user: CurrentUser = Depends(require_officer)):
    return _verify_chain()


@router.get(".csv")
async def export_csv(
    actor_role: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    user: CurrentUser = Depends(require_officer),
):
    filters = {
        "actor_role": actor_role, "action": action, "target_type": target_type,
    }
    sql, params = _query(filters, limit=10_000, offset=0)  # bidder auth excluded by _query

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(sql, params)
            rows = dict_all(cur)
    finally:
        conn.close()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "actor_role", "actor_label",
        "action", "target_type", "target_id", "detail", "hash",
    ])
    for r in rows:
        writer.writerow([
            r["id"], r["timestamp"], r["actor_role"], r["actor_label"],
            r["action"], r["target_type"], r.get("target_id") or "",
            r.get("detail") or "", r["hash"],
        ])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit.csv"'},
    )
