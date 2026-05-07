from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import hashlib
import sys
import os
import uuid

from app.database import get_db
from app.schemas.bidder import BidderCreate, BidderResponse, BidderDocumentResponse
from app.config import UPLOADS_DIR
from app.audit import log as audit_log
from app.services.ingest import process_bidder_document, detect_format
import psycopg2
from psycopg2.extras import DictCursor
from ..db_connection import DB_URL

router = APIRouter()


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


@router.post("/{tender_id}/bidders", response_model=BidderResponse)
async def add_bidder(
    tender_id: str, 
    bidder: BidderCreate, 
    db: Session = Depends(get_db)
):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO bidders (
                    id, tender_id, company_name, contact_email,
                    registration_number, status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING *
                """,
                (
                    str(uuid.uuid4()),
                    tender_id,
                    bidder.company_name,
                    bidder.contact_email,
                    bidder.registration_number,
                    "submitted",
                ),
            )
            result = dict_fetchone(cur)
            conn.commit()
            return result
    finally:
        conn.close()


@router.get("/{tender_id}/bidders", response_model=List[BidderResponse])
async def list_bidders(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT b.*,
                       e.overall_verdict,
                       e.final_verdict,
                       e.score,
                       e.total_criteria,
                       e.passed_criteria,
                       e.failed_criteria,
                       e.review_criteria
                FROM bidders b
                LEFT JOIN evaluations e ON e.bidder_id = b.id
                WHERE b.tender_id = %s
                ORDER BY b.created_at DESC
                """,
                (tender_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.get("/{tender_id}/bidders/{bidder_id}", response_model=BidderResponse)
async def get_bidder(tender_id: str, bidder_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM bidders WHERE id = %s AND tender_id = %s",
                (bidder_id, tender_id),
            )
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Bidder not found")
            return result
    finally:
        conn.close()


@router.post("/{tender_id}/bidders/{bidder_id}/documents", status_code=201)
async def upload_bidder_documents(
    tender_id: str,
    bidder_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    """Save each file, persist a row, and queue OCR in the background."""
    conn = get_conn()
    try:
        saved_documents = []

        for file in files:
            file_content = await file.read()
            safe_name = os.path.basename(file.filename or "file")
            ts = uuid.uuid4().hex[:8]
            rel_dir = os.path.join(UPLOADS_DIR, "bidders", bidder_id)
            os.makedirs(rel_dir, exist_ok=True)
            file_path = os.path.join(rel_dir, f"{ts}_{safe_name}")
            with open(file_path, "wb") as f:
                f.write(file_content)

            file_hash = hashlib.sha256(file_content).hexdigest()
            document_id = str(uuid.uuid4())
            fmt = detect_format(file_path)

            with conn.cursor(cursor_factory=DictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO bidder_documents (
                        id, bidder_id, filename, file_path, file_hash,
                        format, processed, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())
                    RETURNING *
                    """,
                    (document_id, bidder_id, safe_name, file_path, file_hash, fmt),
                )
                result = dict_fetchone(cur)
                saved_documents.append(result)

            audit_log(
                actor=None, actor_role="bidder", actor_label="Bidder",
                action="bidder.document.uploaded",
                target_type="bidder", target_id=bidder_id,
                detail={
                    "document_id": document_id, "filename": safe_name,
                    "format": fmt, "size": len(file_content),
                },
            )
            background_tasks.add_task(
                process_bidder_document, document_id, file_path, bidder_id
            )

        conn.commit()
        return {"message": "Documents uploaded; OCR queued.", "documents": saved_documents}
    finally:
        conn.close()


@router.get("/{tender_id}/bidders/{bidder_id}/documents", response_model=List[BidderDocumentResponse])
async def list_bidder_documents(tender_id: str, bidder_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM bidder_documents WHERE bidder_id = %s ORDER BY created_at DESC",
                (bidder_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()