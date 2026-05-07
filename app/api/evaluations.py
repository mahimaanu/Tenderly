from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import sys
import os
import uuid
import logging

from app.database import get_db
from app.schemas.evaluation import EvaluationResponse, CriterionEvaluationResponse, ManualReview, Verdict
import psycopg2
from psycopg2.extras import DictCursor
from ..db_connection import DB_URL

router = APIRouter()
logger = logging.getLogger(__name__)


def get_conn():
    return psycopg2.connect(DB_URL)


def dict_fetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def dict_fetchone(cursor):
    row = cursor.fetchone()
    if row is None:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


@router.post("/{tender_id}/evaluate", status_code=202)
async def start_evaluation(tender_id: str, background_tasks: BackgroundTasks):
    """Kick off evaluation in the background and return a job_id immediately."""
    from app.services.evaluation_engine import evaluate_tender
    from app.audit import log as audit_log

    job_id = str(uuid.uuid4())
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evaluation_jobs (id, tender_id, status, progress_percent, created_at)
                VALUES (%s, %s, 'queued', 0, NOW())
                """,
                (job_id, tender_id),
            )
            conn.commit()
        audit_log(
            actor=None, actor_role="system",
            action="evaluation.started",
            target_type="tender", target_id=tender_id,
            detail={"job_id": job_id},
        )
    finally:
        conn.close()

    def _run():
        c = get_conn()
        try:
            with c.cursor() as cur:
                cur.execute(
                    "UPDATE evaluation_jobs SET status='running', started_at=NOW() WHERE id=%s",
                    (job_id,),
                )
                c.commit()
            evaluate_tender(tender_id)
            with c.cursor() as cur:
                cur.execute(
                    "UPDATE evaluation_jobs SET status='completed', finished_at=NOW(), progress_percent=100 WHERE id=%s",
                    (job_id,),
                )
                c.commit()
            audit_log(
                actor=None, actor_role="system",
                action="evaluation.completed",
                target_type="tender", target_id=tender_id,
                detail={"job_id": job_id},
            )
        except Exception as e:
            with c.cursor() as cur:
                cur.execute(
                    "UPDATE evaluation_jobs SET status='failed', finished_at=NOW(), error=%s WHERE id=%s",
                    (psycopg2.extras.Json({"message": str(e)}), job_id),
                )
                c.commit()
            logger.exception("Evaluation failed")
        finally:
            c.close()

    background_tasks.add_task(_run)
    return {"job_id": job_id, "tender_id": tender_id, "status": "queued"}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM evaluation_jobs WHERE id = %s", (job_id,))
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Job not found")
            return result
    finally:
        conn.close()


@router.get("/{tender_id}/evaluations", response_model=List[EvaluationResponse])
async def get_all_evaluations(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM evaluations WHERE tender_id = %s ORDER BY created_at DESC",
                (tender_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.get("/{tender_id}/bidders/{bidder_id}/evaluation", response_model=EvaluationResponse)
async def get_bidder_evaluation(tender_id: str, bidder_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM evaluations WHERE tender_id = %s AND bidder_id = %s",
                (tender_id, bidder_id),
            )
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Evaluation not found")
            return result
    finally:
        conn.close()


@router.get("/{tender_id}/evaluations/{evaluation_id}/criterion-evaluations", response_model=List[CriterionEvaluationResponse])
async def get_criterion_evaluations(evaluation_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT ce.*, c.description as criterion_description
                FROM criterion_evaluations ce
                JOIN criteria c ON ce.criterion_id = c.id
                WHERE ce.evaluation_id = %s
                ORDER BY ce.created_at
                """,
                (evaluation_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.get("/{tender_id}/reviews/pending")
async def get_pending_reviews(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT ce.*, c.description as criterion_description, b.company_name as bidder_name
                FROM criterion_evaluations ce
                JOIN evaluations e ON ce.evaluation_id = e.id
                JOIN criteria c ON ce.criterion_id = c.id
                JOIN bidders b ON e.bidder_id = b.id
                WHERE e.tender_id = %s AND ce.verdict = 'needs_review'
                ORDER BY ce.created_at
                """,
                (tender_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.post("/criterion-evaluations/{eval_id}/review")
async def submit_manual_review(eval_id: str, review: ManualReview):
    """Officer overrides the system verdict on a single criterion evaluation."""
    from app.audit import log as audit_log

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                UPDATE criterion_evaluations
                SET manually_reviewed = TRUE,
                    manual_verdict = %s,
                    reviewer_notes = %s,
                    reviewed_by = %s,
                    reviewed_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (review.verdict, review.reviewer_notes, review.reviewed_by, eval_id),
            )
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Criterion evaluation not found")

            evaluation_id = result["evaluation_id"]

            # Recalculate evaluation aggregates using effective verdicts:
            # - if manually_reviewed: use manual_verdict
            # - else: use original AI verdict
            cur.execute(
                """
                UPDATE evaluations e
                SET
                    passed_criteria = (
                        SELECT COUNT(*) FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                        AND (
                            (ce.manually_reviewed IS NOT TRUE AND ce.verdict = 'eligible')
                            OR (ce.manually_reviewed = TRUE AND ce.manual_verdict = 'eligible')
                        )
                    ),
                    failed_criteria = (
                        SELECT COUNT(*) FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                        AND (
                            (ce.manually_reviewed IS NOT TRUE AND ce.verdict = 'not_eligible')
                            OR (ce.manually_reviewed = TRUE AND ce.manual_verdict = 'not_eligible')
                        )
                    ),
                    review_criteria = (
                        SELECT COUNT(*) FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                        AND ce.verdict = 'needs_review'
                        AND ce.manually_reviewed IS NOT TRUE
                    ),
                    score = (
                        SELECT ROUND(
                            COUNT(*) FILTER (WHERE
                                (ce.manually_reviewed IS NOT TRUE AND ce.verdict = 'eligible')
                                OR (ce.manually_reviewed = TRUE AND ce.manual_verdict = 'eligible')
                            )::decimal * 100.0
                            / NULLIF(COUNT(*), 0),
                            2
                        )
                        FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                    ),
                    overall_verdict = CASE
                        WHEN EXISTS (
                            SELECT 1 FROM criterion_evaluations ce
                            JOIN criteria c ON ce.criterion_id = c.id
                            WHERE ce.evaluation_id = e.id
                            AND c.priority = 'mandatory'
                            AND (
                                (ce.manually_reviewed IS NOT TRUE AND ce.verdict = 'not_eligible')
                                OR (ce.manually_reviewed = TRUE AND ce.manual_verdict = 'not_eligible')
                            )
                        ) THEN 'not_eligible'
                        WHEN EXISTS (
                            SELECT 1 FROM criterion_evaluations ce
                            WHERE ce.evaluation_id = e.id
                            AND ce.verdict = 'needs_review'
                            AND ce.manually_reviewed IS NOT TRUE
                        ) THEN 'needs_review'
                        ELSE 'eligible'
                    END,
                    requires_manual_review = EXISTS (
                        SELECT 1 FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                        AND ce.verdict = 'needs_review'
                        AND ce.manually_reviewed IS NOT TRUE
                    ),
                    review_completed = NOT EXISTS (
                        SELECT 1 FROM criterion_evaluations ce
                        WHERE ce.evaluation_id = e.id
                        AND ce.verdict = 'needs_review'
                        AND ce.manually_reviewed IS NOT TRUE
                    )
                WHERE e.id = %s
                """,
                (evaluation_id,),
            )
            conn.commit()
        audit_log(
            actor=None, actor_role="officer", actor_label="Officer",
            action="criterion_eval.overridden",
            target_type="criterion_evaluation", target_id=eval_id,
            detail={"verdict": review.verdict, "notes": review.reviewer_notes},
        )
        return {"message": "Review submitted successfully", "evaluation": result}
    finally:
        conn.close()


@router.post("/criterion-evaluations/{eval_id}/verify")
async def verify_criterion_evaluation(eval_id: str):
    """Officer marks a criterion evaluation as verified without changing the verdict."""
    from app.audit import log as audit_log

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                UPDATE criterion_evaluations
                SET verified = TRUE, verified_at = NOW()
                WHERE id = %s
                RETURNING id, verdict, verified, verified_at
                """,
                (eval_id,),
            )
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Criterion evaluation not found")
            conn.commit()
        audit_log(
            actor=None, actor_role="officer", actor_label="Officer",
            action="criterion_eval.verified",
            target_type="criterion_evaluation", target_id=eval_id,
        )
        return {"message": "Evaluation marked verified", "evaluation": result}
    finally:
        conn.close()


@router.post("/criterion-evaluations/{eval_id}/request-reupload", status_code=201)
async def request_reupload(eval_id: str, payload: dict | None = None):
    """Officer requests the bidder re-upload the document backing this criterion.

    Creates a `clarifications` row + a `notifications` row for the bidder.
    """
    from app.audit import log as audit_log

    note = (payload or {}).get("note") or "Please re-upload a clearer copy of the supporting document."

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            # Walk: criterion_evaluation → evaluation → tender, bidder → bidder_user
            cur.execute(
                """
                SELECT ce.id              AS ce_id,
                       ce.review_reason   AS review_reason,
                       e.tender_id        AS tender_id,
                       e.bidder_id        AS bidder_id,
                       b.bidder_user_id   AS bidder_user_id,
                       b.company_name     AS bidder_name,
                       c.criterion_code   AS criterion_code,
                       c.description      AS criterion_desc
                FROM criterion_evaluations ce
                JOIN evaluations e ON ce.evaluation_id = e.id
                JOIN bidders b      ON e.bidder_id = b.id
                LEFT JOIN criteria c ON ce.criterion_id = c.id
                WHERE ce.id = %s
                """,
                (eval_id,),
            )
            row = dict_fetchone(cur)
            if not row:
                raise HTTPException(status_code=404, detail="Criterion evaluation not found")

            clar_id = str(uuid.uuid4())
            subject = f"Re-upload requested · {row.get('criterion_code') or 'criterion'}"
            cur.execute(
                """
                INSERT INTO clarifications
                    (id, tender_id, bidder_id, bidder_user_id, criterion_evaluation_id,
                     initiated_by_role, subject, body, status, created_at)
                VALUES (%s, %s, %s, %s, %s, 'officer', %s, %s, 'open', NOW())
                """,
                (clar_id, row["tender_id"], row["bidder_id"], row.get("bidder_user_id"),
                 eval_id, subject, note),
            )

            # Notify the bidder if an account is linked
            if row.get("bidder_user_id"):
                cur.execute(
                    """
                    INSERT INTO notifications
                        (user_id, user_role, kind, title, body,
                         target_url, related_tender_id, related_bidder_id)
                    VALUES (%s, 'bidder', 'reupload_requested', %s, %s, %s, %s, %s)
                    """,
                    (
                        row["bidder_user_id"], subject, note,
                        f"/bidder/clarifications",
                        row["tender_id"], row["bidder_id"],
                    ),
                )
            conn.commit()

        audit_log(
            actor=None, actor_role="officer", actor_label="Officer",
            action="criterion_eval.reupload_requested",
            target_type="criterion_evaluation", target_id=eval_id,
            detail={
                "clarification_id": clar_id,
                "tender_id": row["tender_id"],
                "bidder_id": row["bidder_id"],
                "criterion_code": row.get("criterion_code"),
            },
        )
        return {
            "message": "Re-upload requested.",
            "clarification_id": clar_id,
            "bidder_notified": bool(row.get("bidder_user_id")),
        }
    finally:
        conn.close()