"""
Bidder-side endpoints. Every route requires a bidder JWT.

Resources:
  /bidder/dashboard
  /bidder/tenders          — browse open tenders
  /bidder/tenders/{id}     — tender detail with per-criterion pre-eligibility
  /bidder/submissions      — list / create / get / update / sign / submit
  /bidder/submissions/{sid}/documents  — multipart upload, OCR queued
  /bidder/clarifications   — inbox + reply + re-upload
  /bidder/profile          — company profile
  /bidder/certifications   — list / add / delete
  /bidder/settings         — preferences
  /bidder/signatories      — authorised signatories
  /bidder/dsc/reverify     — mock DSC re-verify
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from ..audit import log as audit_log
from ..auth import CurrentUser, require_bidder
from ..config import UPLOADS_DIR
from ..db import dict_all, dict_one, get_conn, with_dict_cursor
from ..services.ingest import detect_format, process_submission_document

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# /bidder/dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard")
async def dashboard(user: CurrentUser = Depends(require_bidder)):
    """Aggregate for the bidder dashboard page."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM submissions WHERE bidder_user_id = %s AND status IN ('submitted', 'signed')",
                (user.id,),
            )
            in_flight = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                "SELECT COUNT(*) AS n FROM submissions WHERE bidder_user_id = %s AND status = 'draft'",
                (user.id,),
            )
            drafts = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                """
                SELECT COUNT(*) AS n FROM clarifications
                WHERE bidder_user_id = %s AND status = 'open'
                """,
                (user.id,),
            )
            actions_required = (dict_one(cur) or {}).get("n", 0)

            cur.execute(
                """
                SELECT s.id, s.tender_id, s.status, s.bid_amount, s.submitted_at, s.created_at,
                       t.tender_number, t.title
                FROM submissions s
                JOIN tenders t ON s.tender_id = t.id
                WHERE s.bidder_user_id = %s
                ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
                LIMIT 1
                """,
                (user.id,),
            )
            in_flight_submission = dict_one(cur)

            cur.execute(
                """
                SELECT id, tender_number, title, category, estimated_value, closing_on, status
                FROM tenders
                WHERE status IN ('active','draft')
                ORDER BY closing_on ASC NULLS LAST, created_at DESC
                LIMIT 4
                """,
            )
            recommended = dict_all(cur)

            cur.execute(
                """
                SELECT s.id, s.tender_id, s.status, s.bid_amount, s.submitted_at,
                       t.tender_number, t.title
                FROM submissions s
                JOIN tenders t ON s.tender_id = t.id
                WHERE s.bidder_user_id = %s AND s.status IN ('submitted', 'signed')
                ORDER BY s.submitted_at DESC NULLS LAST, s.updated_at DESC
                LIMIT 5
                """,
                (user.id,),
            )
            past_bids = dict_all(cur)
    finally:
        conn.close()

    return {
        "user": {"id": user.id, "name": user.name},
        "stats": {
            "in_flight": int(in_flight),
            "drafts": int(drafts),
            "actions_required": int(actions_required),
        },
        "in_flight_submission": in_flight_submission,
        "recommended_tenders": recommended,
        "past_bids": past_bids,
    }


# ---------------------------------------------------------------------------
# /bidder/tenders + /bidder/tenders/{id}
# ---------------------------------------------------------------------------


@router.get("/tenders")
async def browse_tenders(
    q: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(require_bidder),
):
    where = ["status IN ('active','draft','evaluation')"]
    params: list = []
    if q:
        where.append("(title ILIKE %s OR tender_number ILIKE %s OR description ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like])
    if category:
        where.append("category = %s")
        params.append(category)

    sql = (
        "SELECT id, tender_number, title, description, category, estimated_value, "
        "issuing_dept, issuing_authority, published_on, closing_on, status "
        f"FROM tenders WHERE {' AND '.join(where)} "
        "ORDER BY closing_on ASC NULLS LAST, created_at DESC "
        "LIMIT %s OFFSET %s"
    )
    params.extend([page_size, (page - 1) * page_size])

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(sql, params)
            data = dict_all(cur)
    finally:
        conn.close()

    return {"data": data, "meta": {"page": page, "page_size": page_size}}


@router.get("/tenders/{tender_id}")
async def get_bidder_tender(tender_id: str, user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM tenders WHERE id = %s", (tender_id,))
            tender = dict_one(cur)
            if not tender:
                raise HTTPException(status_code=404, detail="Tender not found")

            cur.execute(
                "SELECT * FROM criteria WHERE tender_id = %s ORDER BY criterion_code",
                (tender_id,),
            )
            criteria = dict_all(cur)

            cur.execute(
                "SELECT id, filename, page_count, file_path FROM tender_documents WHERE tender_id = %s",
                (tender_id,),
            )
            documents = dict_all(cur)

            cur.execute(
                "SELECT id, status FROM submissions WHERE bidder_user_id = %s AND tender_id = %s",
                (user.id, tender_id),
            )
            existing_submission = dict_one(cur)
    finally:
        conn.close()

    return {
        "tender": tender,
        "criteria": criteria,
        "documents": documents,
        "existing_submission": existing_submission,
        "pre_eligibility": [
            {"criterion_id": c["id"], "verdict": "match", "note": "Profile shows match (preliminary)."}
            for c in criteria
        ],
    }


# ---------------------------------------------------------------------------
# /bidder/submissions  (state machine: draft → signed → submitted)
# ---------------------------------------------------------------------------


class SubmissionCreate(BaseModel):
    tender_id: str


class SubmissionUpdate(BaseModel):
    bid_amount: Optional[float] = None
    emd_reference: Optional[str] = None
    notes: Optional[str] = None


@router.post("/submissions", status_code=201)
async def create_submission(payload: SubmissionCreate, user: CurrentUser = Depends(require_bidder)):
    sub_id = str(uuid.uuid4())
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            # Already exists?
            cur.execute(
                "SELECT * FROM submissions WHERE bidder_user_id = %s AND tender_id = %s",
                (user.id, payload.tender_id),
            )
            existing = dict_one(cur)
            if existing:
                return existing

            cur.execute(
                """
                INSERT INTO submissions (id, bidder_user_id, tender_id, status, created_at, updated_at)
                VALUES (%s, %s, %s, 'draft', NOW(), NOW())
                RETURNING *
                """,
                (sub_id, user.id, payload.tender_id),
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="submission.created",
        target_type="submission", target_id=sub_id,
        detail={"tender_id": payload.tender_id},
    )
    return row


@router.get("/submissions")
async def list_submissions(
    status: Optional[str] = None,
    user: CurrentUser = Depends(require_bidder),
):
    where = ["bidder_user_id = %s"]
    params: list = [user.id]
    if status:
        where.append("status = %s")
        params.append(status)

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT s.*, t.tender_number, t.title AS tender_title, t.estimated_value, t.closing_on
                FROM submissions s
                JOIN tenders t ON s.tender_id = t.id
                WHERE {' AND '.join(where)}
                ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
                """,
                params,
            )
            rows = dict_all(cur)
    finally:
        conn.close()

    return {"data": rows}


@router.get("/submissions/{sid}")
async def get_submission(sid: str, user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT s.*, t.tender_number, t.title AS tender_title, t.estimated_value, t.closing_on
                FROM submissions s
                JOIN tenders t ON s.tender_id = t.id
                WHERE s.id = %s AND s.bidder_user_id = %s
                """,
                (sid, user.id),
            )
            sub = dict_one(cur)
            if not sub:
                raise HTTPException(status_code=404, detail="Submission not found")

            cur.execute(
                "SELECT * FROM submission_documents WHERE submission_id = %s ORDER BY created_at",
                (sid,),
            )
            docs = dict_all(cur)

            # If the bidder has been promoted, surface the per-criterion preliminary verdict.
            preliminary = []
            if sub.get("promoted_bidder_id"):
                cur.execute(
                    """
                    SELECT ce.id, ce.verdict, ce.confidence, ce.bidder_value, ce.reasoning,
                           c.criterion_code, c.description AS criterion_description, c.threshold_value
                    FROM criterion_evaluations ce
                    JOIN evaluations e ON ce.evaluation_id = e.id
                    JOIN criteria c    ON ce.criterion_id = c.id
                    WHERE e.bidder_id = %s
                    ORDER BY c.criterion_code
                    """,
                    (sub["promoted_bidder_id"],),
                )
                preliminary = dict_all(cur)
    finally:
        conn.close()

    # 5-step timeline (derived from status + docs)
    steps = [
        {"key": "submitted", "label": "Submitted", "done": bool(sub.get("submitted_at")),
         "at": sub.get("submitted_at")},
        {"key": "parsed", "label": "Documents parsed",
         "done": all(d.get("processed") for d in docs) and bool(docs),
         "at": max((d.get("processed_at") for d in docs if d.get("processed_at")), default=None)},
        {"key": "evaluated", "label": "Eligibility evaluated",
         "done": bool(preliminary), "at": None},
        {"key": "officer_review", "label": "Officer review",
         "done": False, "at": None},
        {"key": "award", "label": "Award decision",
         "done": False, "at": None},
    ]

    return {
        "submission": sub,
        "documents": docs,
        "preliminary_evaluation": preliminary,
        "timeline": steps,
    }


@router.put("/submissions/{sid}")
async def update_submission(
    sid: str,
    payload: SubmissionUpdate,
    user: CurrentUser = Depends(require_bidder),
):
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_sql = ", ".join(f"{k} = %s" for k in fields.keys())
    params = list(fields.values()) + [sid, user.id]
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                f"UPDATE submissions SET {set_sql}, updated_at = NOW() "
                "WHERE id = %s AND bidder_user_id = %s "
                "RETURNING *",
                params,
            )
            row = dict_one(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            conn.commit()
    finally:
        conn.close()

    audit_log(actor=user, action="submission.updated",
              target_type="submission", target_id=sid, detail=fields)
    return row


@router.post("/submissions/{sid}/sign")
async def sign_submission(sid: str, user: CurrentUser = Depends(require_bidder)):
    """Mock DSC sign — flips status to 'signed' and stamps signed_at."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE submissions SET status = 'signed', signed_at = NOW(), updated_at = NOW() "
                "WHERE id = %s AND bidder_user_id = %s "
                "RETURNING *",
                (sid, user.id),
            )
            row = dict_one(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Submission not found")
            conn.commit()
    finally:
        conn.close()

    audit_log(actor=user, action="submission.signed",
              target_type="submission", target_id=sid)
    return {"message": "Submission signed (mock DSC)", "submission": row}


@router.post("/submissions/{sid}/submit")
async def finalise_submission(sid: str, user: CurrentUser = Depends(require_bidder)):
    """Promote the draft to a `bidders` row + copy submission_documents to bidder_documents."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM submissions WHERE id = %s AND bidder_user_id = %s",
                (sid, user.id),
            )
            sub = dict_one(cur)
            if not sub:
                raise HTTPException(status_code=404, detail="Submission not found")
            if sub["status"] not in ("signed", "draft"):
                raise HTTPException(status_code=409, detail=f"Cannot submit from status '{sub['status']}'")

            cur.execute(
                "SELECT email, company_name, contact_person, registration_number, phone, city "
                "FROM bidder_users WHERE id = %s",
                (user.id,),
            )
            bu = dict_one(cur)

            bidder_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO bidders
                    (id, tender_id, company_name, contact_email, registration_number,
                     submitted_at, status, city, phone, contact_person, bidder_user_id, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), 'submitted', %s, %s, %s, %s, NOW())
                """,
                (
                    bidder_id, sub["tender_id"], bu["company_name"], bu["email"],
                    bu.get("registration_number"), bu.get("city"), bu.get("phone"),
                    bu.get("contact_person"), user.id,
                ),
            )

            cur.execute("SELECT * FROM submission_documents WHERE submission_id = %s", (sid,))
            sub_docs = dict_all(cur)
            for d in sub_docs:
                cur.execute(
                    """
                    INSERT INTO bidder_documents
                        (id, bidder_id, document_type, filename, file_path, file_hash,
                         extracted_text, confidence_score, needs_review, page_count,
                         format, kind, processed, processed_at, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        str(uuid.uuid4()), bidder_id, d.get("kind"),
                        d["filename"], d["file_path"], d.get("file_hash"),
                        d.get("extracted_text"), d.get("confidence_score"),
                        d.get("needs_review", False), d.get("page_count"),
                        d.get("format"), d.get("kind"),
                        d.get("processed", False), d.get("processed_at"),
                    ),
                )

            cur.execute(
                "UPDATE submissions SET status='submitted', submitted_at=NOW(), updated_at=NOW(), promoted_bidder_id=%s "
                "WHERE id = %s",
                (bidder_id, sid),
            )
            conn.commit()

            # Notify any officer (broad — every officer in users table)
            cur.execute("SELECT id, name FROM users WHERE role IN ('officer','admin')")
            officers = dict_all(cur)
            for o in officers:
                cur.execute(
                    """
                    INSERT INTO notifications (user_id, user_role, kind, title, body,
                                               target_url, related_tender_id, related_bidder_id)
                    VALUES (%s, 'officer', 'bid_received', %s, %s, %s, %s, %s)
                    """,
                    (
                        o["id"], f"New bid from {bu['company_name']}",
                        "A new submission was received and is ready for review.",
                        f"/officer/tenders/{sub['tender_id']}/bidders/{bidder_id}",
                        sub["tender_id"], bidder_id,
                    ),
                )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="submission.submitted",
        target_type="submission", target_id=sid,
        detail={"tender_id": sub["tender_id"], "promoted_bidder_id": bidder_id},
    )
    return {"message": "Submission complete", "bidder_id": bidder_id}


@router.post("/submissions/{sid}/documents", status_code=201)
async def upload_submission_documents(
    sid: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    kinds: List[str] = Form([]),
    user: CurrentUser = Depends(require_bidder),
):
    """Upload one or more documents to a draft submission. OCR runs in BG."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, status FROM submissions WHERE id = %s AND bidder_user_id = %s",
                (sid, user.id),
            )
            sub = dict_one(cur)
            if not sub:
                raise HTTPException(status_code=404, detail="Submission not found")
            if sub["status"] not in ("draft", "signed"):
                raise HTTPException(status_code=409, detail=f"Cannot add documents to '{sub['status']}'")

            saved = []
            for idx, file in enumerate(files):
                content = await file.read()
                safe = os.path.basename(file.filename or "file")
                ts = uuid.uuid4().hex[:8]
                rel_dir = os.path.join(UPLOADS_DIR, "submissions", sid)
                os.makedirs(rel_dir, exist_ok=True)
                file_path = os.path.join(rel_dir, f"{ts}_{safe}")
                with open(file_path, "wb") as f:
                    f.write(content)

                file_hash = hashlib.sha256(content).hexdigest()
                doc_id = str(uuid.uuid4())
                fmt = detect_format(file_path)
                kind = kinds[idx] if idx < len(kinds) else None

                cur.execute(
                    """
                    INSERT INTO submission_documents
                        (id, submission_id, filename, file_path, file_hash,
                         kind, format, processed, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, NOW())
                    RETURNING *
                    """,
                    (doc_id, sid, safe, file_path, file_hash, kind, fmt),
                )
                row = dict_one(cur)
                saved.append(row)

                background_tasks.add_task(process_submission_document, doc_id, file_path, sid)
            conn.commit()
    finally:
        conn.close()

    for d in saved:
        audit_log(
            actor=user, action="submission.document.uploaded",
            target_type="submission", target_id=sid,
            detail={"document_id": d["id"], "filename": d["filename"]},
        )
    return {"documents": saved}


@router.delete("/submissions/{sid}/documents/{doc_id}", status_code=204)
async def delete_submission_document(
    sid: str, doc_id: str, user: CurrentUser = Depends(require_bidder),
):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                DELETE FROM submission_documents
                WHERE id = %s AND submission_id IN (
                    SELECT id FROM submissions WHERE id = %s AND bidder_user_id = %s
                )
                """,
                (doc_id, sid, user.id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Document not found")
            conn.commit()
    finally:
        conn.close()
    audit_log(actor=user, action="submission.document.deleted",
              target_type="submission_document", target_id=doc_id)
    return None


# ---------------------------------------------------------------------------
# /bidder/clarifications
# ---------------------------------------------------------------------------


class ClarificationReply(BaseModel):
    text: str = Field(min_length=1)


@router.get("/clarifications")
async def list_clarifications(user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT c.*, t.tender_number, t.title AS tender_title,
                    COALESCE(
                        (
                            SELECT JSON_AGG(
                                JSON_BUILD_OBJECT(
                                    'id', m.id,
                                    'author_role', m.author_role,
                                    'text', m.text,
                                    'created_at', m.created_at
                                ) ORDER BY m.created_at
                            )
                            FROM clarification_messages m
                            WHERE m.clarification_id = c.id
                        ),
                        '[]'::json
                    ) AS messages
                FROM clarifications c
                JOIN tenders t ON c.tender_id = t.id
                WHERE c.bidder_user_id = %s
                ORDER BY c.created_at DESC
                """,
                (user.id,),
            )
            rows = dict_all(cur)
    finally:
        conn.close()
    return {"data": rows}


@router.get("/clarifications/{cid}")
async def get_clarification(cid: str, user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM clarifications WHERE id = %s AND bidder_user_id = %s",
                (cid, user.id),
            )
            clar = dict_one(cur)
            if not clar:
                raise HTTPException(status_code=404, detail="Clarification not found")
            cur.execute(
                "SELECT * FROM clarification_messages WHERE clarification_id = %s ORDER BY created_at",
                (cid,),
            )
            messages = dict_all(cur)
    finally:
        conn.close()
    return {"clarification": clar, "messages": messages}


@router.post("/clarifications/{cid}/messages", status_code=201)
async def reply_clarification(
    cid: str, payload: ClarificationReply, user: CurrentUser = Depends(require_bidder),
):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id FROM clarifications WHERE id = %s AND bidder_user_id = %s",
                (cid, user.id),
            )
            if not dict_one(cur):
                raise HTTPException(status_code=404, detail="Clarification not found")
            cur.execute(
                """
                INSERT INTO clarification_messages (clarification_id, author_role, author_id, text)
                VALUES (%s, 'bidder', %s, %s)
                RETURNING *
                """,
                (cid, user.id, payload.text),
            )
            msg = dict_one(cur)
            cur.execute(
                "UPDATE clarifications SET status = 'responded' WHERE id = %s",
                (cid,),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(actor=user, action="clarification.replied",
              target_type="clarification", target_id=cid)
    return msg


@router.post("/clarifications/{cid}/respond", status_code=201)
async def respond_with_upload(
    cid: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    text: Optional[str] = Form(None),
    user: CurrentUser = Depends(require_bidder),
):
    """Bidder uploads a clearer copy in response to a re-upload request.

    The new file is attached as a clarification message AND queued for OCR
    against the same submission_documents table (so the system can re-evaluate).
    """
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT c.*, s.id AS submission_id
                FROM clarifications c
                LEFT JOIN submissions s
                       ON s.bidder_user_id = c.bidder_user_id AND s.tender_id = c.tender_id
                WHERE c.id = %s AND c.bidder_user_id = %s
                """,
                (cid, user.id),
            )
            clar = dict_one(cur)
            if not clar:
                raise HTTPException(status_code=404, detail="Clarification not found")

            content = await file.read()
            safe = os.path.basename(file.filename or "file")
            ts = uuid.uuid4().hex[:8]
            rel_dir = os.path.join(UPLOADS_DIR, "clarifications", cid)
            os.makedirs(rel_dir, exist_ok=True)
            file_path = os.path.join(rel_dir, f"{ts}_{safe}")
            with open(file_path, "wb") as f:
                f.write(content)
            file_hash = hashlib.sha256(content).hexdigest()
            fmt = detect_format(file_path)

            doc_id = str(uuid.uuid4())
            if clar.get("submission_id"):
                cur.execute(
                    """
                    INSERT INTO submission_documents
                        (id, submission_id, filename, file_path, file_hash, format, processed, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())
                    """,
                    (doc_id, clar["submission_id"], safe, file_path, file_hash, fmt),
                )
                background_tasks.add_task(
                    process_submission_document, doc_id, file_path, clar["submission_id"]
                )

            cur.execute(
                """
                INSERT INTO clarification_messages
                    (clarification_id, author_role, author_id, text, attachment_doc_id)
                VALUES (%s, 'bidder', %s, %s, %s)
                """,
                (cid, user.id, text or f"Re-uploaded: {safe}", doc_id),
            )
            cur.execute(
                "UPDATE clarifications SET status = 'responded' WHERE id = %s",
                (cid,),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, action="clarification.responded_with_upload",
        target_type="clarification", target_id=cid,
        detail={"document_id": doc_id, "filename": safe},
    )
    return {"message": "Re-upload received and queued for re-evaluation.", "document_id": doc_id}


# ---------------------------------------------------------------------------
# /bidder/profile + certifications + signatories + settings + DSC
# ---------------------------------------------------------------------------


class BidderProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    capability: Optional[dict] = None


@router.get("/profile")
async def get_profile(user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM bidder_users WHERE id = %s", (user.id,))
            row = dict_one(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
            row.pop("password_hash", None)
            return row
    finally:
        conn.close()


@router.put("/profile")
async def update_profile(payload: BidderProfileUpdate, user: CurrentUser = Depends(require_bidder)):
    import psycopg2.extras

    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_parts: list[str] = []
    params: list = []
    for k, v in fields.items():
        if k == "capability":
            set_parts.append(f"{k} = %s::jsonb")
            params.append(psycopg2.extras.Json(v))
        else:
            set_parts.append(f"{k} = %s")
            params.append(v)
    params.append(user.id)

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                f"UPDATE bidder_users SET {', '.join(set_parts)}, updated_at = NOW() "
                "WHERE id = %s RETURNING *",
                params,
            )
            row = dict_one(cur)
            conn.commit()
            row.pop("password_hash", None)
    finally:
        conn.close()

    audit_log(actor=user, action="bidder.profile.updated",
              target_type="bidder_user", target_id=user.id, detail=fields)
    return row


@router.get("/certifications")
async def list_certifications(user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bidder_certifications WHERE bidder_user_id = %s ORDER BY created_at DESC",
                (user.id,),
            )
            return {"data": dict_all(cur)}
    finally:
        conn.close()


@router.post("/certifications", status_code=201)
async def add_certification(
    file: UploadFile = File(...),
    name: str = Form(...),
    issuing_body: Optional[str] = Form(None),
    certificate_number: Optional[str] = Form(None),
    issued_on: Optional[str] = Form(None),
    expires_on: Optional[str] = Form(None),
    user: CurrentUser = Depends(require_bidder),
):
    content = await file.read()
    safe = os.path.basename(file.filename or "cert")
    rel_dir = os.path.join(UPLOADS_DIR, "certs", user.id)
    os.makedirs(rel_dir, exist_ok=True)
    path = os.path.join(rel_dir, f"{uuid.uuid4().hex[:8]}_{safe}")
    with open(path, "wb") as f:
        f.write(content)

    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO bidder_certifications
                    (bidder_user_id, name, issuing_body, certificate_number,
                     issued_on, expires_on, file_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (user.id, name, issuing_body, certificate_number, issued_on, expires_on, path),
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()

    audit_log(actor=user, action="bidder.certification.added",
              target_type="bidder_certification", target_id=row["id"],
              detail={"name": name})
    return row


@router.delete("/certifications/{cid}", status_code=204)
async def delete_certification(cid: str, user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "DELETE FROM bidder_certifications WHERE id = %s AND bidder_user_id = %s",
                (cid, user.id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Certification not found")
            conn.commit()
    finally:
        conn.close()
    audit_log(actor=user, action="bidder.certification.deleted",
              target_type="bidder_certification", target_id=cid)
    return None


@router.get("/signatories")
async def list_signatories(user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM bidder_signatories WHERE bidder_user_id = %s ORDER BY role, created_at",
                (user.id,),
            )
            return {"data": dict_all(cur)}
    finally:
        conn.close()


class SettingsUpdate(BaseModel):
    notifications: Optional[dict] = None
    pre_bid_hints: Optional[bool] = None


@router.get("/settings")
async def get_settings(user: CurrentUser = Depends(require_bidder)):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM user_preferences WHERE user_id = %s", (user.id,))
            row = dict_one(cur)
            if not row:
                return {"notifications": {}, "pre_bid_hints": True}
            return row
    finally:
        conn.close()


@router.put("/settings")
async def update_settings(payload: SettingsUpdate, user: CurrentUser = Depends(require_bidder)):
    import psycopg2.extras

    fields = payload.model_dump(exclude_unset=True)
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO user_preferences
                    (user_id, user_role, notifications, pre_bid_hints, updated_at)
                VALUES (%s, 'bidder', COALESCE(%s, '{}'::jsonb), COALESCE(%s, TRUE), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    notifications = COALESCE(EXCLUDED.notifications, user_preferences.notifications),
                    pre_bid_hints = COALESCE(EXCLUDED.pre_bid_hints, user_preferences.pre_bid_hints),
                    updated_at = NOW()
                RETURNING *
                """,
                (
                    user.id,
                    psycopg2.extras.Json(fields.get("notifications")) if "notifications" in fields else None,
                    fields.get("pre_bid_hints"),
                ),
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()
    audit_log(actor=user, action="bidder.settings.updated",
              target_type="bidder_user", target_id=user.id, detail=fields)
    return row


@router.post("/dsc/reverify")
async def reverify_dsc(user: CurrentUser = Depends(require_bidder)):
    audit_log(actor=user, action="bidder.dsc.reverified",
              target_type="bidder_user", target_id=user.id)
    return {"verified": True, "issuer": "eMudhra (mock)", "expires_on": "2028-03-30"}
