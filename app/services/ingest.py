"""
Background-task helpers that run DocumentProcessor over an uploaded file and
persist the OCR / extraction result back to the database.

Two flavours:
- process_tender_document(document_id, file_path)   → updates tender_documents
- process_bidder_document(document_id, file_path)   → updates bidder_documents
- process_submission_document(document_id, file_path) → updates submission_documents

All are safe to call from FastAPI BackgroundTasks; failures are logged but
never raised (the user already got their 201).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import psycopg2

from ..audit import log as audit_log
from ..config import (
    DATABASE_URL,
    DOCUMENT_PROCESSING_ENABLED,
    OCR_CONFIDENCE_FLOOR,
)

logger = logging.getLogger(__name__)


# DocumentProcessor is heavy (loads PaddleOCR weights). Initialise once and reuse.
_processor = None


def _get_processor():
    global _processor
    if _processor is None:
        try:
            from .document_processor import DocumentProcessor
            _processor = DocumentProcessor()
        except Exception as e:  # paddleocr / fitz import failures
            logger.exception(f"DocumentProcessor failed to initialise: {e}")
            _processor = False  # sentinel — won't try again this process
    return _processor or None


def _detect_format(file_path: str) -> str:
    """Map a file path to the UI's `format` enum (PDF | Scanned PDF | Photograph | DOCX)."""
    suffix = Path(file_path).suffix.lower()
    if suffix in {".docx", ".doc"}:
        return "DOCX"
    if suffix in {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}:
        return "Photograph"
    if suffix == ".pdf":
        try:
            from .document_processor import DocumentProcessor, DocumentType
            kind = DocumentProcessor()._classify_pdf(file_path)
            return "PDF" if kind == DocumentType.NATIVE_PDF else "Scanned PDF"
        except Exception:
            return "PDF"
    return suffix.upper().lstrip(".") or "FILE"


def _process(file_path: str, document_id: str):
    if not DOCUMENT_PROCESSING_ENABLED:
        logger.info("DOCUMENT_PROCESSING_ENABLED=false — skipping OCR for %s", file_path)
        return None
    proc = _get_processor()
    if proc is None:
        logger.warning("DocumentProcessor unavailable; skipping OCR for %s", file_path)
        return None
    try:
        return proc.process(file_path, document_id)
    except Exception as e:
        logger.exception(f"DocumentProcessor.process failed for {file_path}: {e}")
        return None


def _conn():
    return psycopg2.connect(DATABASE_URL)


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def process_tender_document(document_id: str, file_path: str, tender_id: str) -> None:
    """Process an uploaded tender RFP and extract eligibility criteria via Claude."""
    from .criteria_extractor import extract_criteria_with_claude, save_criteria  # noqa: PLC0415

    fmt = _detect_format(file_path)

    # --- get page count via pymupdf (no OCR needed) --------------------------
    page_count: Optional[int] = None
    try:
        import pymupdf  # noqa: PLC0415
        doc = pymupdf.open(file_path)
        page_count = len(doc)
        doc.close()
    except Exception as e:
        logger.warning("pymupdf page count failed for %s: %s", file_path, e)

    # --- update document record ----------------------------------------------
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE tender_documents
                SET page_count = COALESCE(%s, page_count),
                    processed  = TRUE
                WHERE id = %s
                """,
                (page_count, document_id),
            )
            conn.commit()
    finally:
        conn.close()

    # --- extract criteria via Claude ------------------------------------------
    logger.info("Extracting criteria from %s using Claude", file_path)
    criteria = extract_criteria_with_claude(file_path)

    if criteria:
        conn2 = _conn()
        try:
            n = save_criteria(tender_id, criteria, conn2)
            logger.info("Saved %d criteria for tender %s", n, tender_id)
        finally:
            conn2.close()

    audit_log(
        actor=None, actor_role="system", actor_label="System",
        action="tender.criteria.extracted",
        target_type="tender", target_id=tender_id,
        detail={
            "document_id": document_id,
            "format": fmt,
            "page_count": page_count,
            "criteria_extracted": len(criteria),
        },
    )


def process_bidder_document(document_id: str, file_path: str, bidder_id: str) -> None:
    """Run OCR + persist for a bidder document. Updates confidence & needs_review."""
    fmt = _detect_format(file_path)
    result = _process(file_path, document_id)

    extracted = ""
    confidence: Optional[float] = None
    page_count: Optional[int] = None
    needs_review = False
    if result is not None:
        try:
            extracted = "\n\n".join(p.text for p in result.pages)
            confidence = float(result.overall_confidence)
            page_count = len(result.pages)
            needs_review = confidence < OCR_CONFIDENCE_FLOOR
        except Exception:
            pass

    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE bidder_documents
                SET extracted_text   = %s,
                    confidence_score = %s,
                    needs_review     = %s,
                    page_count       = COALESCE(%s, page_count),
                    format           = COALESCE(format, %s),
                    processed        = TRUE,
                    processed_at     = NOW()
                WHERE id = %s
                """,
                (extracted, confidence, needs_review, page_count, fmt, document_id),
            )
            conn.commit()
        audit_log(
            actor=None, actor_role="system", actor_label="System",
            action="bidder.document.processed",
            target_type="bidder_document", target_id=document_id,
            detail={
                "bidder_id": bidder_id,
                "format": fmt,
                "page_count": page_count,
                "confidence": confidence,
                "needs_review": needs_review,
            },
        )
    finally:
        conn.close()


def process_submission_document(document_id: str, file_path: str, submission_id: str) -> None:
    """Run OCR + persist for a bidder submission draft document."""
    fmt = _detect_format(file_path)
    result = _process(file_path, document_id)

    extracted = ""
    confidence: Optional[float] = None
    page_count: Optional[int] = None
    needs_review = False
    if result is not None:
        try:
            extracted = "\n\n".join(p.text for p in result.pages)
            confidence = float(result.overall_confidence)
            page_count = len(result.pages)
            needs_review = confidence < OCR_CONFIDENCE_FLOOR
        except Exception:
            pass

    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE submission_documents
                SET extracted_text   = %s,
                    confidence_score = %s,
                    needs_review     = %s,
                    page_count       = COALESCE(%s, page_count),
                    format           = COALESCE(format, %s),
                    processed        = TRUE,
                    processed_at     = NOW()
                WHERE id = %s
                """,
                (extracted, confidence, needs_review, page_count, fmt, document_id),
            )
            conn.commit()
        audit_log(
            actor=None, actor_role="system", actor_label="System",
            action="submission.document.processed",
            target_type="submission_document", target_id=document_id,
            detail={
                "submission_id": submission_id,
                "format": fmt,
                "page_count": page_count,
                "confidence": confidence,
                "needs_review": needs_review,
            },
        )
    finally:
        conn.close()


def detect_format(file_path: str) -> str:
    """Public alias for callers that want to record format synchronously."""
    return _detect_format(file_path)
