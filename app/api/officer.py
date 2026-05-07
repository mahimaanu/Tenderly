"""
Officer-only convenience endpoints — dashboard aggregator, cross-tender manual
review queue, reports analytics, search, profile, preferences.
"""

import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import CurrentUser, require_officer
from ..audit import log as audit_log
from ..db import dict_all, dict_one, get_conn, with_dict_cursor

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# /officer/dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard")
async def dashboard(user: CurrentUser = Depends(require_officer)):
    """Single endpoint backing the officer dashboard. Returns:
    - 4 stat cards (active tenders, bids received, eligible count, pending review)
    - headline tender (most-recent under_evaluation)
    - recent bidder evaluations (5)
    - recent audit activity (6)
    """
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            # ---- stats ----
            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE status IN ('active','evaluation','draft'))    AS active_tenders,
                    COUNT(*) FILTER (WHERE status = 'evaluation')                        AS evaluating_tenders,
                    COUNT(*) FILTER (WHERE status = 'active')                            AS open_tenders
                FROM tenders
                """,
            )
            tender_stats = dict_one(cur) or {}

            cur.execute("SELECT COUNT(*) AS n FROM bidders")
            bids_received = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE overall_verdict = 'eligible')      AS eligible,
                    COUNT(*) FILTER (WHERE overall_verdict = 'not_eligible')  AS ineligible,
                    COUNT(*) FILTER (WHERE overall_verdict = 'needs_review')  AS needs_review
                FROM evaluations
                """,
            )
            v = dict_one(cur) or {}

            # needs_review count — one per bidder, not per criterion row
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM (
                    SELECT DISTINCT e.bidder_id
                    FROM criterion_evaluations ce
                    JOIN evaluations e ON ce.evaluation_id = e.id
                    WHERE ce.verdict = 'needs_review' AND ce.manually_reviewed IS NOT TRUE
                    UNION
                    SELECT b.id AS bidder_id
                    FROM bidders b
                    LEFT JOIN evaluations e ON e.bidder_id = b.id
                    WHERE e.id IS NULL AND b.status = 'submitted'
                ) combined
                """,
            )
            criterion_review_count = (dict_one(cur) or {}).get("n", 0)

            # ---- headline tender ----
            cur.execute(
                """
                SELECT t.*, em.eligible_count, em.ineligible_count, em.review_count, em.total_bidders
                FROM tenders t
                LEFT JOIN evaluation_matrix em ON em.tender_id = t.id
                WHERE t.status IN ('evaluation','active')
                ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
                LIMIT 1
                """,
            )
            headline = dict_one(cur)

            # ---- recent bidders (across all tenders) ----
            cur.execute(
                """
                SELECT b.id, b.company_name, b.city, b.registration_number,
                       b.tender_id, t.tender_number, t.title AS tender_title,
                       e.overall_verdict, e.score
                FROM bidders b
                JOIN tenders t ON b.tender_id = t.id
                LEFT JOIN evaluations e ON e.bidder_id = b.id
                ORDER BY b.created_at DESC
                LIMIT 5
                """,
            )
            recent_bidders = dict_all(cur)

            # ---- recent activity ----
            cur.execute(
                """
                SELECT id, timestamp, actor_role, actor_label, action, target_type, target_id, detail
                FROM audit_events
                ORDER BY timestamp DESC
                LIMIT 6
                """,
            )
            recent_activity = dict_all(cur)
    finally:
        conn.close()

    return {
        "user": {"id": user.id, "name": user.name, "role": user.role},
        "stats": {
            "active_tenders": int(tender_stats.get("active_tenders") or 0),
            "evaluating_tenders": int(tender_stats.get("evaluating_tenders") or 0),
            "bids_received": int(bids_received),
            "eligible": int(v.get("eligible") or 0),
            "ineligible": int(v.get("ineligible") or 0),
            "needs_review": int(criterion_review_count),
        },
        "headline_tender": headline,
        "recent_bidders": recent_bidders,
        "recent_activity": recent_activity,
    }


# ---------------------------------------------------------------------------
# /officer/bidder-evaluations  (full list, all tenders)
# ---------------------------------------------------------------------------


@router.get("/bidder-evaluations")
async def list_bidder_evaluations(
    verdict: Optional[str] = None,
    tender_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(require_officer),
):
    """Return all bidder evaluations (with verdict, score, criteria counts,
    average confidence) across all tenders, paginated."""
    where = []
    params: list = []
    if verdict:
        where.append("e.overall_verdict = %s")
        params.append(verdict)
    if tender_id:
        where.append("b.tender_id = %s")
        params.append(tender_id)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    offset = (page - 1) * page_size

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS n
                FROM bidders b
                LEFT JOIN evaluations e ON e.bidder_id = b.id
                {where_sql}
                """,
                params,
            )
            total = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                f"""
                SELECT
                    b.id, b.company_name, b.city, b.registration_number,
                    b.tender_id,
                    t.tender_number, t.title AS tender_title,
                    e.id            AS evaluation_id,
                    e.overall_verdict,
                    e.score,
                    e.total_criteria,
                    e.passed_criteria,
                    e.failed_criteria,
                    e.review_criteria,
                    e.evaluated_at,
                    (
                        SELECT ROUND(AVG(ce.confidence)::numeric, 2)
                        FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                          AND ce.confidence IS NOT NULL
                    ) AS avg_confidence
                FROM bidders b
                JOIN tenders t ON b.tender_id = t.id
                LEFT JOIN evaluations e ON e.bidder_id = b.id
                {where_sql}
                ORDER BY e.evaluated_at DESC NULLS LAST, b.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [page_size, offset],
            )
            rows = dict_all(cur)
    finally:
        conn.close()

    return {"data": rows, "total": int(total), "page": page, "page_size": page_size}


# ---------------------------------------------------------------------------
# /officer/manual-review (cross-tender)
# ---------------------------------------------------------------------------


@router.get("/manual-review")
async def manual_review_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    count_only: int = Query(0),
    user: CurrentUser = Depends(require_officer),
):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS n FROM (
                    SELECT DISTINCT e.bidder_id
                    FROM criterion_evaluations ce
                    JOIN evaluations e ON ce.evaluation_id = e.id
                    WHERE ce.verdict = 'needs_review' AND ce.manually_reviewed IS NOT TRUE
                    UNION
                    SELECT b.id AS bidder_id
                    FROM bidders b
                    LEFT JOIN evaluations e ON e.bidder_id = b.id
                    WHERE e.id IS NULL AND b.status = 'submitted'
                ) combined
                """,
            )
            total = (dict_one(cur) or {}).get("n", 0)

            if count_only:
                return {"count": int(total)}

            # One row per bidder — either has pending criterion reviews or is unevaluated
            cur.execute(
                """
                SELECT
                    b.company_name,
                    b.registration_number,
                    b.city,
                    e.tender_id,
                    e.bidder_id,
                    t.tender_number,
                    t.title                AS tender_title,
                    e.id::text             AS evaluation_id,
                    e.total_criteria,
                    e.passed_criteria      AS eligible_count,
                    e.failed_criteria      AS not_eligible_count,
                    e.review_criteria      AS needs_review_count,
                    COUNT(ce.id) FILTER (
                        WHERE ce.verdict = 'needs_review' AND ce.manually_reviewed IS NOT TRUE
                    )::integer             AS pending_review_count,
                    e.evaluated_at         AS flagged_at,
                    'criterion_review'::text AS item_type
                FROM evaluations e
                JOIN bidders b ON e.bidder_id = b.id
                JOIN tenders t ON e.tender_id = t.id
                LEFT JOIN criterion_evaluations ce ON ce.evaluation_id = e.id
                GROUP BY
                    b.company_name, b.registration_number, b.city,
                    e.tender_id, e.bidder_id, t.tender_number, t.title,
                    e.id, e.total_criteria, e.passed_criteria,
                    e.failed_criteria, e.review_criteria, e.evaluated_at
                HAVING COUNT(ce.id) FILTER (
                    WHERE ce.verdict = 'needs_review' AND ce.manually_reviewed IS NOT TRUE
                ) > 0

                UNION ALL

                SELECT
                    b.company_name,
                    b.registration_number,
                    b.city,
                    t.id               AS tender_id,
                    b.id               AS bidder_id,
                    t.tender_number,
                    t.title            AS tender_title,
                    NULL::text         AS evaluation_id,
                    NULL::integer      AS total_criteria,
                    NULL::integer      AS eligible_count,
                    NULL::integer      AS not_eligible_count,
                    NULL::integer      AS needs_review_count,
                    NULL::integer      AS pending_review_count,
                    b.created_at       AS flagged_at,
                    'unevaluated_bidder'::text AS item_type
                FROM bidders b
                JOIN tenders t ON b.tender_id = t.id
                LEFT JOIN evaluations e ON e.bidder_id = b.id
                WHERE e.id IS NULL AND b.status = 'submitted'

                ORDER BY flagged_at DESC
                LIMIT %s OFFSET %s
                """,
                (page_size, (page - 1) * page_size),
            )
            data = dict_all(cur)
    finally:
        conn.close()

    return {"data": data, "total": int(total), "meta": {"page": page, "page_size": page_size}}


# ---------------------------------------------------------------------------
# /officer/reports — analytics for the Reports & Analytics page
# ---------------------------------------------------------------------------


@router.get("/reports")
async def reports_analytics(
    fy: Optional[str] = Query(None),
    user: CurrentUser = Depends(require_officer),
):
    """Aggregated analytics across all tenders.
    `fy` filter is accepted but currently unused (single-cycle dataset)."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM tenders")
            tenders_n = (dict_one(cur) or {}).get("n", 0)

            cur.execute("SELECT COUNT(*) AS n FROM bidders")
            bidders_n = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE overall_verdict = 'eligible')      AS eligible,
                    COUNT(*) FILTER (WHERE overall_verdict = 'not_eligible')  AS ineligible,
                    COUNT(*) FILTER (WHERE overall_verdict = 'needs_review')  AS needs_review
                FROM evaluations
                """,
            )
            verdict_mix = dict_one(cur) or {}

            cur.execute(
                """
                SELECT format, COUNT(*) AS n
                FROM bidder_documents
                WHERE format IS NOT NULL
                GROUP BY format
                ORDER BY n DESC
                """,
            )
            doc_format_mix = dict_all(cur)

            cur.execute(
                """
                SELECT to_char(date_trunc('month', evaluated_at), 'Mon') AS month,
                       COUNT(*) AS n
                FROM evaluations
                WHERE evaluated_at IS NOT NULL
                GROUP BY date_trunc('month', evaluated_at)
                ORDER BY date_trunc('month', evaluated_at)
                """,
            )
            time_series = dict_all(cur)

            # top failing-criterion descriptions
            cur.execute(
                """
                SELECT c.description, COUNT(*) AS n
                FROM criterion_evaluations ce
                JOIN criteria c ON ce.criterion_id = c.id
                WHERE ce.verdict = 'not_eligible'
                GROUP BY c.description
                ORDER BY n DESC
                LIMIT 5
                """,
            )
            top_rejections = dict_all(cur)

            cur.execute(
                """
                SELECT COUNT(*) AS n
                FROM criterion_evaluations
                WHERE verdict = 'needs_review'
                """,
            )
            ambiguous = (dict_one(cur) or {}).get("n", 0)
    finally:
        conn.close()

    return {
        "stats": {
            "tenders": int(tenders_n),
            "bidders": int(bidders_n),
            "eligible": int(verdict_mix.get("eligible") or 0),
            "ineligible": int(verdict_mix.get("ineligible") or 0),
            "needs_review": int(verdict_mix.get("needs_review") or 0),
            "ambiguous_surfaced": int(ambiguous),
        },
        "verdict_mix": verdict_mix,
        "document_format_mix": doc_format_mix,
        "monthly_evaluations": time_series,
        "top_rejection_reasons": top_rejections,
    }


# ---------------------------------------------------------------------------
# /search
# ---------------------------------------------------------------------------


@router.get("/search")
async def officer_search(
    q: str = Query(..., min_length=2),
    type: Optional[str] = Query(None, pattern="^(tenders|bidders|criteria)$"),
    user: CurrentUser = Depends(require_officer),
):
    out: dict = {}
    like = f"%{q}%"
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            if type in (None, "tenders"):
                cur.execute(
                    """
                    SELECT id, tender_number, title, status
                    FROM tenders
                    WHERE title ILIKE %s OR tender_number ILIKE %s OR description ILIKE %s
                    ORDER BY created_at DESC LIMIT 10
                    """,
                    (like, like, like),
                )
                out["tenders"] = dict_all(cur)
            if type in (None, "bidders"):
                cur.execute(
                    """
                    SELECT id, tender_id, company_name, registration_number, city
                    FROM bidders
                    WHERE company_name ILIKE %s OR registration_number ILIKE %s OR contact_email ILIKE %s
                    ORDER BY created_at DESC LIMIT 10
                    """,
                    (like, like, like),
                )
                out["bidders"] = dict_all(cur)
            if type in (None, "criteria"):
                cur.execute(
                    """
                    SELECT id, tender_id, criterion_code, type, priority, description
                    FROM criteria
                    WHERE description ILIKE %s OR criterion_code ILIKE %s
                    ORDER BY created_at DESC LIMIT 10
                    """,
                    (like, like),
                )
                out["criteria"] = dict_all(cur)
    finally:
        conn.close()
    return {"query": q, "results": out}


# ---------------------------------------------------------------------------
# /officer/bidders/{bidder_id}/verdict  — manual verdict for unevaluated bidder
# ---------------------------------------------------------------------------


class NotifyBidderPayload(BaseModel):
    subject: str
    body: str


@router.post("/bidders/{bidder_id}/notify", status_code=201)
async def notify_bidder(
    bidder_id: str,
    payload: NotifyBidderPayload,
    user: CurrentUser = Depends(require_officer),
):
    """Officer sends a direct message to a bidder. Creates a clarification thread
    visible in the bidder portal's Clarifications tab."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT b.id, b.tender_id, b.company_name, b.bidder_user_id,
                       t.tender_number
                FROM bidders b
                JOIN tenders t ON b.tender_id = t.id
                WHERE b.id = %s
                """,
                (bidder_id,),
            )
            bidder = dict_one(cur)
            if not bidder:
                raise HTTPException(status_code=404, detail="Bidder not found")

            clar_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO clarifications
                    (id, tender_id, bidder_id, bidder_user_id, criterion_evaluation_id,
                     initiated_by_role, initiated_by, subject, body, status, created_at)
                VALUES (%s, %s, %s, %s, NULL, 'officer', %s, %s, %s, 'open', NOW())
                """,
                (
                    clar_id,
                    bidder["tender_id"],
                    bidder_id,
                    bidder.get("bidder_user_id"),
                    user.id,          # UUID — officer's user id
                    payload.subject,
                    payload.body,
                ),
            )

            # Insert the initial message so it appears in the thread
            cur.execute(
                """
                INSERT INTO clarification_messages
                    (clarification_id, author_role, author_id, text, created_at)
                VALUES (%s, 'officer', %s, %s, NOW())
                """,
                (clar_id, user.id, payload.body),
            )

            # Notify the bidder if they have a portal account
            if bidder.get("bidder_user_id"):
                cur.execute(
                    """
                    INSERT INTO notifications
                        (user_id, user_role, kind, title, body,
                         target_url, related_tender_id, related_bidder_id)
                    VALUES (%s, 'bidder', 'officer_message', %s, %s, %s, %s, %s)
                    """,
                    (
                        bidder["bidder_user_id"],
                        payload.subject,
                        payload.body[:200],
                        "/bidder/clarifications",
                        bidder["tender_id"],
                        bidder_id,
                    ),
                )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="officer.bidder.notified",
        target_type="bidder", target_id=bidder_id,
        detail={"clarification_id": clar_id, "subject": payload.subject},
    )
    return {"message": "Message sent", "clarification_id": clar_id}


class ManualBidderVerdict(BaseModel):
    verdict: Literal["eligible", "not_eligible"]
    reviewer_notes: Optional[str] = None


@router.post("/bidders/{bidder_id}/verdict", status_code=201)
async def set_bidder_verdict(
    bidder_id: str,
    payload: ManualBidderVerdict,
    user: CurrentUser = Depends(require_officer),
):
    """Create an evaluation record with a manually set overall verdict for a bidder
    that has not yet been through the automated evaluation pipeline."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, tender_id FROM bidders WHERE id = %s",
                (bidder_id,),
            )
            bidder = dict_one(cur)
            if not bidder:
                raise HTTPException(status_code=404, detail="Bidder not found")

            cur.execute(
                "SELECT id FROM evaluations WHERE bidder_id = %s",
                (bidder_id,),
            )
            if dict_one(cur):
                raise HTTPException(status_code=409, detail="Bidder already has an evaluation record")

            tender_id = bidder["tender_id"]
            cur.execute(
                """
                INSERT INTO evaluations (
                    tender_id, bidder_id, overall_verdict, final_verdict,
                    score, total_criteria, passed_criteria, failed_criteria,
                    review_criteria, requires_manual_review, review_completed,
                    evaluated_at
                )
                VALUES (%s, %s, %s, %s, 0, 0, 0, 0, 0, FALSE, TRUE, NOW())
                RETURNING id
                """,
                (tender_id, bidder_id, payload.verdict, payload.verdict),
            )
            eval_id = dict_one(cur)["id"]

            cur.execute(
                "UPDATE bidders SET status = 'evaluated' WHERE id = %s",
                (bidder_id,),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="bidder.verdict.manual_set",
        target_type="bidder", target_id=bidder_id,
        detail={
            "evaluation_id": str(eval_id),
            "verdict": payload.verdict,
            "reviewer_notes": payload.reviewer_notes,
        },
    )
    return {"message": "Verdict set", "evaluation_id": str(eval_id), "verdict": payload.verdict}


@router.post("/bidders/{bidder_id}/evaluate", status_code=201)
async def evaluate_single_bidder(
    bidder_id: str,
    user: CurrentUser = Depends(require_officer),
):
    """Run the AI evaluation pipeline for a single unevaluated bidder.

    Matches bidder documents against the tender's extracted criteria and
    persists the evaluation + per-criterion results. Returns the summary
    immediately so the caller can surface results without a round-trip.
    """
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT id, tender_id FROM bidders WHERE id = %s", (bidder_id,))
            bidder = dict_one(cur)
            if not bidder:
                raise HTTPException(status_code=404, detail="Bidder not found")
            cur.execute("SELECT id FROM evaluations WHERE bidder_id = %s", (bidder_id,))
            if dict_one(cur):
                raise HTTPException(status_code=409, detail="Bidder already has an evaluation")
    finally:
        conn.close()

    try:
        from app.services.evaluation_engine import evaluate_single_bidder as _run
        result = _run(bidder["tender_id"], bidder_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    audit_log(
        actor=user, action="bidder.evaluated.manual_trigger",
        target_type="bidder", target_id=bidder_id,
        detail={"overall_verdict": result["overall_verdict"], "evaluation_id": result["evaluation_id"]},
    )
    return result


class FinalVerdictPayload(BaseModel):
    verdict: Literal["eligible", "not_eligible"]


@router.post("/evaluations/{eval_id}/final-verdict")
async def set_final_verdict(
    eval_id: str,
    payload: FinalVerdictPayload,
    user: CurrentUser = Depends(require_officer),
):
    """Officer sets the final verdict on an existing evaluation, overriding the AI result.
    Marks all pending criterion evaluations as manually reviewed so they leave the queue.
    """
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                UPDATE evaluations
                SET final_verdict = %s, review_completed = TRUE, updated_at = NOW()
                WHERE id = %s
                RETURNING id, bidder_id, tender_id
                """,
                (payload.verdict, eval_id),
            )
            row = dict_one(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Evaluation not found")

            cur.execute(
                """
                UPDATE criterion_evaluations
                SET manually_reviewed = TRUE, manual_verdict = %s, reviewed_at = NOW()
                WHERE evaluation_id = %s AND manually_reviewed IS NOT TRUE
                """,
                (payload.verdict, eval_id),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="bidder.verdict.final_set",
        target_type="evaluation", target_id=eval_id,
        detail={"verdict": payload.verdict, "bidder_id": str(row["bidder_id"])},
    )
    return {"message": "Final verdict set", "verdict": payload.verdict}


# ---------------------------------------------------------------------------
# /officer/profile + /officer/preferences
# ---------------------------------------------------------------------------


class OfficerProfileUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    unit: Optional[str] = None
    email: Optional[str] = None


@router.get("/profile")
async def get_profile(user: CurrentUser = Depends(require_officer)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, email, name, role, designation, unit, emp_id "
                "FROM users WHERE id = %s",
                (user.id,),
            )
            row = dict_one(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
            return row
    finally:
        conn.close()


@router.put("/profile")
async def update_profile(
    payload: OfficerProfileUpdate,
    user: CurrentUser = Depends(require_officer),
):
    fields = []
    params: list = []
    for col, value in payload.model_dump(exclude_unset=True).items():
        fields.append(f"{col} = %s")
        params.append(value)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(user.id)

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                f"UPDATE users SET {', '.join(fields)} WHERE id = %s "
                "RETURNING id, email, name, role, designation, unit, emp_id",
                params,
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="officer.profile.updated",
        target_type="user", target_id=user.id,
        detail=payload.model_dump(exclude_unset=True),
    )
    return row


class OfficerPreferences(BaseModel):
    confidence_floor: Optional[float] = None
    ocr_floor: Optional[float] = None
    notifications: Optional[dict] = None
    pre_bid_hints: Optional[bool] = None


@router.get("/preferences")
async def get_preferences(user: CurrentUser = Depends(require_officer)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM user_preferences WHERE user_id = %s", (user.id,))
            row = dict_one(cur)
            if not row:
                return {
                    "confidence_floor": 0.75,
                    "ocr_floor": 0.70,
                    "notifications": {},
                    "pre_bid_hints": True,
                }
            return row
    finally:
        conn.close()


@router.put("/preferences")
async def update_preferences(
    payload: OfficerPreferences,
    user: CurrentUser = Depends(require_officer),
):
    import psycopg2.extras

    fields = payload.model_dump(exclude_unset=True)
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO user_preferences (user_id, user_role, confidence_floor, ocr_floor, notifications, pre_bid_hints, updated_at)
                VALUES (%s, %s, COALESCE(%s, 0.75), COALESCE(%s, 0.70), COALESCE(%s, '{}'::jsonb), COALESCE(%s, TRUE), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    confidence_floor = COALESCE(EXCLUDED.confidence_floor, user_preferences.confidence_floor),
                    ocr_floor = COALESCE(EXCLUDED.ocr_floor, user_preferences.ocr_floor),
                    notifications = COALESCE(EXCLUDED.notifications, user_preferences.notifications),
                    pre_bid_hints = COALESCE(EXCLUDED.pre_bid_hints, user_preferences.pre_bid_hints),
                    updated_at = NOW()
                RETURNING *
                """,
                (
                    user.id, user.role,
                    fields.get("confidence_floor"),
                    fields.get("ocr_floor"),
                    psycopg2.extras.Json(fields.get("notifications")) if "notifications" in fields else None,
                    fields.get("pre_bid_hints"),
                ),
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="officer.preferences.updated",
        target_type="user", target_id=user.id, detail=fields,
    )
    return row


@router.post("/dsc/verify")
async def verify_dsc(user: CurrentUser = Depends(require_officer)):
    """Mock — returns a successful DSC verification for the demo. Replace with
    an eMudhra integration when production-ready."""
    audit_log(
        actor=user, action="officer.dsc.verified",
        target_type="user", target_id=user.id,
    )
    return {"verified": True, "issuer": "eMudhra (mock)", "expires_on": "2027-08-14"}
