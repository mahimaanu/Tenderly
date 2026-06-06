"""
Criteria extraction from tender documents.

Strategy (in order):
1. Native PDF   → extract text with pymupdf directly
2. Scanned PDF  → OCR with pytesseract (Tesseract 5)
3. DOCX         → extract text with python-docx
4. All text     → keyword pattern matching to identify eligibility criteria

If ANTHROPIC_API_KEY is set, Claude Vision is used instead of Tesseract for
higher accuracy (especially for mixed-language / complex layout documents).
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MAX_PAGES_OCR = 15      # pages to OCR (Tesseract)
MAX_PAGES_CLAUDE = 10   # pages to send to Claude Vision


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def _pdf_native_text(file_path: str) -> str:
    import pymupdf
    doc = pymupdf.open(file_path)
    text = "\n\n".join(page.get_text() for page in doc)
    doc.close()
    return text.strip()


def _pdf_ocr_text(file_path: str, max_pages: int = MAX_PAGES_OCR) -> str:
    """Render PDF pages as images and run Tesseract OCR."""
    import pymupdf
    from PIL import Image
    import pytesseract

    doc = pymupdf.open(file_path)
    pages_text: list[str] = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        text = pytesseract.image_to_string(img)
        pages_text.append(text)
    doc.close()
    return "\n\n".join(pages_text).strip()


def _docx_text(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs).strip()


def _extract_text(file_path: str) -> str:
    """Return best-effort text from any supported document."""
    suffix = Path(file_path).suffix.lower()
    try:
        if suffix == ".pdf":
            text = _pdf_native_text(file_path)
            if len(text) > 300:
                return text
            # Scanned — fall back to Tesseract
            logger.info("Native PDF has no text, running Tesseract OCR on %s", file_path)
            return _pdf_ocr_text(file_path)
        if suffix in {".docx", ".doc"}:
            return _docx_text(file_path)
    except Exception as e:
        logger.error("Text extraction failed for %s: %s", file_path, e)
    return ""


# ---------------------------------------------------------------------------
# Keyword / pattern-based criteria detection
# ---------------------------------------------------------------------------

# Each entry: (criterion_code, type, description_hint, patterns)
_CRITERION_PATTERNS = [
    (
        "FIN",
        "financial",
        "Financial turnover / net worth requirement",
        [r"turn.?over", r"net.?worth", r"annual.?revenue", r"financial.?capacity",
         r"crore|lakh|inr|₹", r"balance.?sheet"],
    ),
    (
        "TEC",
        "technical",
        "Technical qualification / certification requirement",
        [r"iso\s*9001", r"iso\s*\d+", r"certification", r"quality.?management",
         r"technical.?bid", r"technical.?specification", r"bia?s.?accredited"],
    ),
    (
        "EXP",
        "experience",
        "Past experience / work order requirement",
        [r"experience.{0,40}year", r"year.{0,40}experience", r"work.?order",
         r"completion.?certificate", r"similar.?work", r"past.{0,20}project",
         r"cpf|crpf|defence|military|paramilitary|government.{0,20}supply"],
    ),
    (
        "CMP-GST",
        "compliance",
        "GST / tax registration compliance",
        [r"gst\b", r"gstin", r"goods.?and.?services.?tax", r"tax.?registration"],
    ),
    (
        "CMP-PAN",
        "compliance",
        "PAN / income tax compliance",
        [r"\bpan\b", r"permanent.?account.?number", r"income.?tax"],
    ),
    (
        "CMP-REG",
        "compliance",
        "Company registration / incorporation requirement",
        [r"registr.{0,20}(company|firm|number)", r"incorporation",
         r"mca|roc|cin\b", r"limited.?company"],
    ),
    (
        "LIC",
        "compliance",
        "License / permit requirement",
        [r"licen[sc]e", r"permit", r"authoris.{0,10}dealer", r"oem\b"],
    ),
    (
        "EMD",
        "compliance",
        "Earnest Money Deposit (EMD) requirement",
        [r"earnest.?money", r"\bemd\b", r"bid.?security", r"bank.?guarantee"],
    ),
    (
        "MSME",
        "documentation",
        "MSME / Startup India registration",
        [r"\bmsme\b", r"micro.{0,15}small.{0,15}medium", r"startup.?india", r"udyam"],
    ),
    (
        "DOC",
        "documentation",
        "Mandatory document submission requirement",
        [r"submit.{0,30}document", r"attach.{0,30}document",
         r"certificate.{0,20}upload", r"form.{0,10}(a|b|c|d|1|2|3|4|5)"],
    ),
]


def _extract_numeric(text_around: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Try to pull a numeric threshold from nearby text, e.g. '≥ ₹50 Crore' → ('50', '>=', 'Cr')."""
    # Look for patterns like ≥₹50Cr / minimum 5 years / at least Rs.100 lakh
    m = re.search(
        r"(minimum|at\s*least|not\s*less\s*than|above|>=|≥|>)\s*"
        r"(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d+)?)\s*(crore|lakh|cr|l|year|years|yr)?",
        text_around, re.IGNORECASE
    )
    if m:
        op = ">="
        val = m.group(2)
        raw_unit = (m.group(3) or "").lower()
        unit_map = {"crore": "Cr", "cr": "Cr", "lakh": "L", "l": "L",
                    "year": "Years", "years": "Years", "yr": "Years"}
        unit = unit_map.get(raw_unit, raw_unit.title() if raw_unit else "")
        return val, op, unit
    return None, None, None


def _rule_based_extraction(text: str) -> list[dict]:
    """Scan OCR'd text for eligibility criteria using keyword patterns."""
    criteria: list[dict] = []
    seen_codes: set[str] = set()
    text_lower = text.lower()

    for base_code, ctype, base_desc, patterns in _CRITERION_PATTERNS:
        matched_snippets: list[str] = []
        for pat in patterns:
            for m in re.finditer(pat, text_lower):
                start = max(0, m.start() - 200)
                end = min(len(text), m.end() + 300)
                matched_snippets.append(text[start:end])

        if not matched_snippets:
            continue

        # Use the first matched snippet to derive a description.
        # Find the sentence that contains the match keyword, then extend to next sentence.
        snippet = matched_snippets[0]
        sentences = re.split(r'(?<=[.;])\s+', snippet)
        # Pick the sentence containing the match pattern, prefer shorter sentences that are specific
        best = base_desc
        for sent in sentences:
            if any(re.search(pat, sent, re.IGNORECASE) for pat in patterns):
                # Try to grab this sentence + the next one for context
                idx = sentences.index(sent)
                context = " ".join(sentences[idx:idx+2]).strip()
                context = re.sub(r'\s+', ' ', context)
                if 20 < len(context) < 300:
                    best = context
                    break
        desc = best[:250]

        val, op, unit = _extract_numeric(snippet)

        code = base_code
        suffix = 1
        while code in seen_codes:
            code = f"{base_code}-{suffix:02d}"
            suffix += 1
        seen_codes.add(code)

        criteria.append({
            "criterion_code": code,
            "type": ctype,
            "priority": "mandatory",
            "description": desc if len(desc) > 20 else base_desc,
            "threshold_value": val,
            "threshold_operator": op,
            "unit": unit,
        })

    return criteria


# ---------------------------------------------------------------------------
# Claude Vision path (used only when ANTHROPIC_API_KEY is set)
# ---------------------------------------------------------------------------

CLAUDE_PROMPT = """You are analyzing a government procurement tender document.

Extract ALL eligibility criteria — financial, technical, experience, compliance, and any others.

For each criterion return a JSON object:
- criterion_code   : e.g. "FIN-01", "TEC-01", "EXP-01", "CMP-01"
- type             : financial | technical | experience | compliance | documentation
- priority         : mandatory | optional
- description      : concise English description (1–2 sentences)
- threshold_value  : numeric threshold if any (e.g. "50", "5")
- threshold_operator: ">=" | "present" | null
- unit             : "Cr" | "Years" | "" etc.

Respond with ONLY a JSON array — no markdown, no explanation."""


def _extract_with_claude(file_path: str) -> list[dict]:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    suffix = Path(file_path).suffix.lower()
    content: list = []

    if suffix == ".pdf":
        text = _pdf_native_text(file_path)
        if len(text) > 300:
            content.append({"type": "text", "text": f"Tender text:\n\n{text[:8000]}"})
        else:
            import pymupdf
            doc = pymupdf.open(file_path)
            for i, page in enumerate(doc):
                if i >= MAX_PAGES_CLAUDE:
                    break
                pix = page.get_pixmap(dpi=150)
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/png",
                               "data": base64.b64encode(pix.tobytes("png")).decode()},
                })
            doc.close()
    elif suffix in {".docx", ".doc"}:
        content.append({"type": "text", "text": _docx_text(file_path)[:8000]})
    else:
        return []

    content.append({"type": "text", "text": CLAUDE_PROMPT})

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": content}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw)
    return result if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_criteria_with_claude(file_path: str) -> list[dict]:
    """Extract criteria from a document. Uses Claude if key is set, else Tesseract+rules."""
    if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY != "your-anthropic-api-key-here":
        try:
            logger.info("Using Claude extraction for %s", file_path)
            criteria = _extract_with_claude(file_path)
            if criteria:
                return criteria
            logger.warning("Claude returned no criteria, falling back to Tesseract")
        except Exception as e:
            logger.error("Claude extraction failed (%s), falling back to Tesseract", e)

    # Tesseract + rule-based fallback
    logger.info("Using Tesseract OCR + rule-based extraction for %s", file_path)
    text = _extract_text(file_path)
    if not text:
        logger.warning("No text extracted from %s", file_path)
        return []
    criteria = _rule_based_extraction(text)
    logger.info("Rule-based extraction found %d criteria in %s", len(criteria), file_path)
    return criteria


def save_criteria(tender_id: str, criteria: list[dict], conn) -> int:
    """Upsert extracted criteria rows for a tender."""
    if not criteria:
        return 0
    inserted = 0
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM criteria WHERE tender_id = %s AND manually_verified = FALSE",
            (tender_id,),
        )
        for c in criteria:
            cur.execute(
                """
                INSERT INTO criteria (
                    id, tender_id, criterion_code, type, priority, description,
                    threshold_value, threshold_operator, unit,
                    manually_verified, confidence, created_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,0.80,NOW())
                """,
                (
                    str(uuid.uuid4()), tender_id,
                    c.get("criterion_code"), c.get("type", "compliance"),
                    c.get("priority", "mandatory"), c.get("description", ""),
                    c.get("threshold_value") or None,
                    c.get("threshold_operator") or None,
                    c.get("unit") or None,
                ),
            )
            inserted += 1
    conn.commit()
    return inserted
