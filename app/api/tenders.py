from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import hashlib
import sys
import os
import uuid

from app.database import get_db
from app.schemas.tender import TenderCreate, TenderResponse, TenderDocumentResponse, CriterionResponse, CriterionCreate, CriterionUpdate
from app.schemas.evaluation import EvaluationResponse
from app.config import UPLOADS_DIR
from app.audit import log as audit_log
from app.services.ingest import process_tender_document, detect_format
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


class TenderCreateJSON(BaseModel):
    title: str
    tender_number: str
    category: Optional[str] = None
    description: Optional[str] = None
    issuing_authority: Optional[str] = None
    submission_deadline: Optional[str] = None
    estimated_value: Optional[str] = None
    emd_amount: Optional[float] = None


@router.post("/create", response_model=TenderResponse)
async def create_tender_json(payload: TenderCreateJSON):
    """Create a tender from JSON — no file required."""
    conn = get_conn()
    try:
        tender_id = str(uuid.uuid4())
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO tenders (
                    id, tender_number, title, description, issuing_authority,
                    submission_deadline, status, created_by, created_at, updated_at,
                    category, estimated_value, reference, emd_amount
                ) VALUES (%s,%s,%s,%s,%s,%s,'active',%s,NOW(),NOW(),%s,%s,%s,%s)
                RETURNING *
                """,
                (
                    tender_id, payload.tender_number, payload.title,
                    payload.description, payload.issuing_authority,
                    payload.submission_deadline or None,
                    None, payload.category,
                    payload.estimated_value, payload.tender_number,
                    payload.emd_amount,
                ),
            )
            result = dict_fetchone(cur)
            conn.commit()
            return result
    finally:
        conn.close()


@router.post("/", response_model=TenderResponse)
async def create_tender(
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    conn = get_conn()
    try:
        # Read file content for processing
        file_content = await file.read()
        file_hash = str(hash(file_content))
        
        # Generate tender ID (UUID)
        tender_id = str(uuid.uuid4())
        
        # Insert tender record
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO tenders (
                    id, tender_number, title, description, issuing_authority,
                    submission_deadline, status, created_by, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING *
                """,
                (
                    tender_id,
                    f"TENDER-{tender_id[:8]}",  # Generate tender number from UUID
                    f"Tender in {category} category",  # Title based on category
                    f"Tender document for {category} category",  # Description
                    "System",  # Issuing authority
                    None,  # Submission deadline (can be set later)
                    "draft",
                    "system",  # Created by
                ),
            )
            result = dict_fetchone(cur)
            
            # Also create a tender document record
            cur.execute(
                """
                INSERT INTO tender_documents (
                    id, tender_id, filename, file_path, file_hash,
                    page_count, processed, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING *
                """,
                (
                    str(uuid.uuid4()),
                    tender_id,
                    file.filename,
                    f"uploads/tenders/{file.filename}",
                    file_hash,
                    1,  # Default page count
                    False,  # Not processed yet
                ),
            )
            
            conn.commit()
            return result
    finally:
        conn.close()


@router.post("/{tender_id}/upload", status_code=201)
async def upload_tender_document(
    tender_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: Optional[str] = None,
):
    """Persist the RFP file and queue OCR / text extraction in the background."""
    conn = get_conn()
    try:
        file_content = await file.read()
        safe_name = os.path.basename(file.filename or "file")
        ts = uuid.uuid4().hex[:8]
        rel_dir = os.path.join(UPLOADS_DIR, "tenders", tender_id)
        os.makedirs(rel_dir, exist_ok=True)
        file_path = os.path.join(rel_dir, f"{ts}_{safe_name}")
        with open(file_path, "wb") as f:
            f.write(file_content)

        file_hash = hashlib.sha256(file_content).hexdigest()
        document_id = str(uuid.uuid4())

        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO tender_documents (
                    id, tender_id, filename, file_path, file_hash,
                    page_count, processed, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING *
                """,
                (document_id, tender_id, safe_name, file_path, file_hash, None, False),
            )
            result = dict_fetchone(cur)
            conn.commit()

        audit_log(
            actor=None, actor_role="officer", actor_label="Officer",
            action="tender.document.uploaded",
            target_type="tender", target_id=tender_id,
            detail={"document_id": document_id, "filename": safe_name, "size": len(file_content)},
        )

        background_tasks.add_task(process_tender_document, document_id, file_path, tender_id)

        return {"message": "Document uploaded; extraction queued.", "document": result}
    finally:
        conn.close()


@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM tenders WHERE id = %s", (tender_id,))
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Tender not found")
            return result
    finally:
        conn.close()


@router.delete("/{tender_id}", status_code=204)
async def delete_tender(tender_id: str):
    """Delete a tender and all its associated data (documents, criteria, bidders, evaluations)."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT id, title, status FROM tenders WHERE id = %s", (tender_id,))
            tender = dict_fetchone(cur)
            if not tender:
                raise HTTPException(status_code=404, detail="Tender not found")

            # Cascade manually in dependency order
            cur.execute(
                """
                DELETE FROM criterion_evaluations
                WHERE evaluation_id IN (SELECT id FROM evaluations WHERE tender_id = %s)
                """,
                (tender_id,),
            )
            cur.execute("DELETE FROM evaluations WHERE tender_id = %s", (tender_id,))
            cur.execute(
                """
                DELETE FROM bidder_documents
                WHERE bidder_id IN (SELECT id FROM bidders WHERE tender_id = %s)
                """,
                (tender_id,),
            )
            cur.execute("DELETE FROM bidders WHERE tender_id = %s", (tender_id,))
            cur.execute("DELETE FROM evaluation_matrix WHERE tender_id = %s", (tender_id,))
            cur.execute("DELETE FROM tender_documents WHERE tender_id = %s", (tender_id,))
            cur.execute("DELETE FROM criteria WHERE tender_id = %s", (tender_id,))
            cur.execute("DELETE FROM tenders WHERE id = %s", (tender_id,))
            conn.commit()

        audit_log(
            actor=None, actor_role="officer",
            action="tender.deleted",
            target_type="tender", target_id=tender_id,
            detail={"title": tender["title"], "status": tender["status"]},
        )
    finally:
        conn.close()


@router.get("/", response_model=List[TenderResponse])
async def list_tenders():
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM tenders ORDER BY created_at DESC")
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.get("/{tender_id}/documents", response_model=List[TenderDocumentResponse])
async def get_tender_documents(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM tender_documents WHERE tender_id = %s ORDER BY created_at DESC",
                (tender_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.get("/{tender_id}/criteria", response_model=List[CriterionResponse])
async def get_extracted_criteria(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM criteria WHERE tender_id = %s ORDER BY created_at DESC",
                (tender_id,),
            )
            return dict_fetchall(cur)
    finally:
        conn.close()


@router.post("/{tender_id}/criteria", response_model=CriterionResponse, status_code=201)
async def add_criterion(tender_id: str, data: CriterionCreate):
    """Manually add an eligibility criterion to a tender (officer-created, not AI-extracted)."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT status FROM tenders WHERE id = %s", (tender_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Tender not found")
            if row[0] != "draft":
                raise HTTPException(status_code=409, detail="Criteria are locked — tender is no longer in draft status")

            cur.execute(
                """
                INSERT INTO criteria
                  (tender_id, criterion_code, type, priority, description,
                   threshold_value, threshold_operator, unit, manually_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                RETURNING *
                """,
                (
                    tender_id,
                    data.criterion_code or None,
                    data.type,
                    data.priority,
                    data.description,
                    data.threshold_value or None,
                    data.threshold_operator or None,
                    data.unit or None,
                ),
            )
            result = dict_fetchone(cur)
            conn.commit()
            return result
    finally:
        conn.close()


@router.put("/{tender_id}/criteria/{criterion_id}")
async def update_criterion(
    tender_id: str, 
    criterion_id: str, 
    data: CriterionUpdate
):
    conn = get_conn()
    try:
        update_fields = []
        values = []
        for field, value in data.model_dump(exclude_unset=True).items():
            update_fields.append(f"{field} = %s")
            values.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        values.extend([criterion_id, tender_id])
        query = f"UPDATE criteria SET {', '.join(update_fields)} WHERE id = %s AND tender_id = %s RETURNING *"
        
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(query, values)
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Criterion not found")
            conn.commit()
            return result
    finally:
        conn.close()


@router.post("/{tender_id}/criteria/confirm")
async def confirm_criteria(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "UPDATE tenders SET status = %s WHERE id = %s RETURNING *",
                ("active", tender_id),
            )
            result = dict_fetchone(cur)
            if not result:
                raise HTTPException(status_code=404, detail="Tender not found")
            conn.commit()
            return {"message": "Criteria confirmed", "tender": result}
    finally:
        conn.close()


@router.post("/{tender_id}/criteria/extract")
async def extract_criteria(tender_id: str, background_tasks: BackgroundTasks):
    """Re-run criteria extraction on the latest uploaded document using Claude."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT id, file_path FROM tender_documents WHERE tender_id = %s ORDER BY created_at DESC LIMIT 1",
                (tender_id,),
            )
            doc = dict_fetchone(cur)
    finally:
        conn.close()

    if not doc or not doc.get("file_path"):
        raise HTTPException(status_code=404, detail="No document uploaded for this tender yet.")

    file_path = doc["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Document file not found on disk: {file_path}")

    from app.services.criteria_extractor import extract_criteria_with_claude, save_criteria
    criteria = extract_criteria_with_claude(file_path)
    if not criteria:
        return {"extracted": 0, "message": "No criteria extracted. Ensure ANTHROPIC_API_KEY is set in .env"}

    conn2 = get_conn()
    try:
        n = save_criteria(tender_id, criteria, conn2)
    finally:
        conn2.close()

    return {"extracted": n, "criteria": criteria}