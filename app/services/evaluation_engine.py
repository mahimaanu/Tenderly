"""
Evaluation Engine for AI-Based Tender Evaluation System
- Uses the database connection defined in db_connection.py
- Works with the schema from prototype_design.md
- Performs a simple rule‑based evaluation (can be replaced with NLP/LLM later)
- Stores results in the `evaluations` and `criterion_evaluations` tables
"""

import sys
import os
import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Tuple, Callable, Optional

# Add the project root to the path so we can import db_connection
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db_connection import DB_URL  # type: ignore
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Database helpers
# ----------------------------------------------------------------------
def get_conn():
    """Return a new psycopg2 connection using the URL from db_connection.py."""
    return psycopg2.connect(DB_URL)

def dict_fetchall(cursor) -> List[Dict]:
    """Return all rows from a cursor as a list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [
        dict(zip(columns, row))
        for row in cursor.fetchall()
    ]

def dict_fetchone(cursor) -> Dict | None:
    """Return a single row from a cursor as a dict (or None)."""
    row = cursor.fetchone()
    if row is None:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))

# ----------------------------------------------------------------------
# Data retrieval functions
# ----------------------------------------------------------------------
def get_tender_criteria(tender_id: str) -> List[Dict]:
    """Load all criteria for a given tender."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT id, criterion_code, type, priority, description,
                       original_text, threshold_value, threshold_operator, unit,
                       source_page, confidence
                FROM criteria
                WHERE tender_id = %s
                ORDER BY criterion_code
                """,
                (tender_id,),
            )
            return dict_fetchall(cur)

def get_bidders(tender_id: str) -> List[Dict]:
    """Load all bidders for a given tender."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT id, company_name, contact_email, registration_number,
                       submitted_at, status
                FROM bidders
                WHERE tender_id = %s
                """,
                (tender_id,),
            )
            return dict_fetchall(cur)

def get_bidder_documents(bidder_id: str) -> List[Dict]:
    """Load all documents that have been uploaded/processed for a bidder."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT id, document_type, filename, file_path, file_hash,
                       extracted_text, confidence_score, needs_review,
                       page_count, processed_at
                FROM bidder_documents
                WHERE bidder_id = %s
                """,
                (bidder_id,),
            )
            return dict_fetchall(cur)

# ----------------------------------------------------------------------
# Simple evaluation logic (placeholder – replace with NLP/LLM later)
# ----------------------------------------------------------------------
def _parse_number(value: str) -> float | None:
    """
    Extract a numeric value from strings like:
    '₹5 crore', '5,00,000', '3 years', '8.5%' etc.
    Returns None if no number can be parsed.
    """
    if not value:
        return None
    # Remove currency symbols, commas, spaces
    cleaned = re.sub(r'[₹$,\s]', '', value.strip().lower())
    multiplier = 1
    if 'crore' in cleaned:
        multiplier = 1_00_00_000
        cleaned = cleaned.replace('crore', '')
    elif 'lakh' in cleaned:
        multiplier = 1_00_000
        cleaned = cleaned.replace('lakh', '')
    # Extract first number (supports decimals)
    m = re.search(r'[\d]+(?:\.[\d]+)?', cleaned)
    if m:
        return float(m.group()) * multiplier
    return None

def evaluate_criterion(criterion: Dict, bidder_text: str) -> Tuple[str, float, str]:
    """
    Very simple rule‑based evaluation.
    Returns (verdict, confidence, reasoning)
    verdict: 'eligible', 'not_eligible', 'needs_review'
    This is a stub – in a real system you would use NER / LLM to extract
    the relevant value and compare it against the criterion.
    """
    desc = criterion['description'].lower()
    threshold = criterion['threshold_value']
    operator = criterion['threshold_operator'] or '>='
    unit = criterion['unit'] or ''

    # Try to parse numbers from the criterion and from the bidder text
    bidder_num = _parse_number(bidder_text)
    threshold_num = _parse_number(threshold) if threshold else None

    # If we cannot parse numbers, fall back to a naive keyword check.
    if bidder_num is None or threshold_num is None:
        words = set(re.findall(r'\w+', desc))
        hits = sum(1 for w in words if w in bidder_text.lower())
        confidence = min(0.9, hits / max(len(words), 1))
        if confidence > 0.5:
            return ('eligible', confidence, f"Keyword match (confidence {confidence:.2f})")
        else:
            return ('needs_review', confidence,
                    f"Insufficient keyword evidence (confidence {confidence:.2f})")

    # Numeric comparison
    try:
        if operator == '>=':
            passed = bidder_num >= threshold_num
        elif operator == '>':
            passed = bidder_num > threshold_num
        elif operator == '<=':
            passed = bidder_num <= threshold_num
        elif operator == '<':
            passed = bidder_num < threshold_num
        else:  # '==' or default
            passed = bidder_num == threshold_num
    except Exception as e:
        logger.warning(f"Numeric comparison failed: {e}")
        return ('needs_review', 0.4, "Error during numeric comparison")

    verdict = 'eligible' if passed else 'not_eligible'
    confidence = 0.85 if passed else 0.80
    reasoning = (
        f"Bidder value {bidder_num} {unit} {operator} {threshold_num} {unit} "
        f"-> {'pass' if passed else 'fail'}"
    )
    return (verdict, confidence, reasoning)

# ----------------------------------------------------------------------
# Main evaluation routine
# ----------------------------------------------------------------------
def evaluate_tender(tender_id: str) -> None:
    """
    Run the evaluation for all bidders of a given tender.
    Steps:
    1. Load criteria and bidders.
    2. For each bidder, combine the extracted text from all its documents.
    3. Evaluate each criterion against that combined text.
    4. Compute an overall verdict (simple rule: any mandatory fail -> not eligible;
       else if any needs review -> needs review; else eligible).
    5. Store the evaluation and criterion‑level results in the database.
    """
    logger.info(f"Starting evaluation for tender {tender_id}")
    criteria = get_tender_criteria(tender_id)
    bidders = get_bidders(tender_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            for bidder in bidders:
                bidder_id = bidder['id']
                logger.info(f"Evaluating bidder {bidder_id} ({bidder['company_name']})")
                # Gather all extracted text from the bidder's documents
                docs = get_bidder_documents(bidder_id)
                combined_text = " ".join(
                    [doc.get('extracted_text', '') for doc in docs if doc.get('extracted_text')]
                )

                # Evaluate each criterion
                criterion_results = []
                for crit in criteria:
                    verdict, confidence, reasoning = evaluate_criterion(crit, combined_text)
                    criterion_results.append({
                        'criterion_id': crit['id'],
                        'verdict': verdict,
                        'confidence': confidence,
                        'reasoning': reasoning,
                        'bidder_value': "",   # placeholder – could store extracted value
                        'requirement': crit['description'],
                        'comparison_detail': "",
                        'source_document_id': None,
                        'source_page': crit.get('source_page'),
                        'source_excerpt': "",
                        'manual_review': False,
                    })

                # Determine overall verdict (simple hierarchy)
                mandatory_not_eligible = any(
                    r['verdict'] == 'not_eligible' and
                    next((c for c in criteria if c['id'] == r['criterion_id']), {}).get('priority') == 'mandatory'
                    for r in criterion_results
                )
                any_needs_review = any(r['verdict'] == 'needs_review' for r in criterion_results)

                if mandatory_not_eligible:
                    overall = 'not_eligible'
                elif any_needs_review:
                    overall = 'needs_review'
                else:
                    overall = 'eligible'

                # Insert into evaluations table
                cur.execute(
                    """
                    INSERT INTO evaluations (
                        tender_id, bidder_id, overall_verdict, score, total_criteria,
                        passed_criteria, failed_criteria, review_criteria,
                        requires_manual_review, review_completed, evaluated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        tender_id,
                        bidder_id,
                        overall,
                        0.0,                     # score placeholder (can be computed later)
                        len(criteria),           # total_criteria
                        sum(1 for r in criterion_results if r['verdict'] == 'eligible'),   # passed
                        sum(1 for r in criterion_results if r['verdict'] == 'not_eligible'),# failed
                        sum(1 for r in criterion_results if r['verdict'] == 'needs_review'),# review
                        any_needs_review,        # requires_manual_review
                        False,                   # review_completed (initially false)
                        datetime.utcnow(),
                    ),
                )
                eval_id = cur.fetchone()[0]
                logger.debug(f"Inserted evaluation {eval_id} for bidder {bidder_id}")

                # Insert each criterion evaluation
                for r in criterion_results:
                    cur.execute(
                        """
                        INSERT INTO criterion_evaluations (
                            evaluation_id, criterion_id, verdict, confidence,
                            requirement, bidder_value, comparison_detail,
                            source_document_id, source_page, source_excerpt,
                            reasoning, review_reason, manually_reviewed,
                            manual_verdict, reviewer_notes, reviewed_by,
                            reviewed_at, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            eval_id,
                            r['criterion_id'],
                            r['verdict'],
                            r['confidence'],
                            r['requirement'],
                            r['bidder_value'],
                            r['comparison_detail'],
                            r['source_document_id'],
                            r['source_page'],
                            r['source_excerpt'],
                            r['reasoning'],
                            None,          # review_reason
                            False,         # manually_reviewed
                            None,          # manual_verdict
                            None,          # reviewer_notes
                            None,          # reviewed_by
                            None,          # reviewed_at
                            datetime.utcnow(),
                        ),
                    )
                logger.info(
                    f"Stored evaluation for bidder {bidder_id} (overall: {overall})"
                )

        conn.commit()
    logger.info(f"Evaluation for tender {tender_id} completed.")


# ----------------------------------------------------------------------
# Single-bidder evaluation (used by the manual-review "Run Eval" action)
# ----------------------------------------------------------------------

def evaluate_single_bidder(tender_id: str, bidder_id: str) -> dict:
    """Evaluate one bidder against the tender's criteria and persist results.

    Returns a summary dict with overall_verdict and per-criterion results
    so the API layer can return them to the caller immediately.
    """
    logger.info(f"Single-bidder evaluation: bidder={bidder_id} tender={tender_id}")
    criteria = get_tender_criteria(tender_id)
    if not criteria:
        raise ValueError(f"No criteria found for tender {tender_id}. Upload and lock criteria first.")

    docs = get_bidder_documents(bidder_id)
    combined_text = " ".join(
        doc.get("extracted_text", "") for doc in docs if doc.get("extracted_text")
    )

    criterion_results = []
    for crit in criteria:
        verdict, confidence, reasoning = evaluate_criterion(crit, combined_text)
        criterion_results.append({
            "criterion_id": crit["id"],
            "criterion_code": crit.get("criterion_code"),
            "description": crit["description"],
            "priority": crit.get("priority"),
            "verdict": verdict,
            "confidence": confidence,
            "reasoning": reasoning,
            "source_page": crit.get("source_page"),
        })

    mandatory_not_eligible = any(
        r["verdict"] == "not_eligible" and
        next((c for c in criteria if c["id"] == r["criterion_id"]), {}).get("priority") == "mandatory"
        for r in criterion_results
    )
    any_needs_review = any(r["verdict"] == "needs_review" for r in criterion_results)

    if mandatory_not_eligible:
        overall = "not_eligible"
    elif any_needs_review:
        overall = "needs_review"
    else:
        overall = "eligible"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evaluations (
                    tender_id, bidder_id, overall_verdict, score, total_criteria,
                    passed_criteria, failed_criteria, review_criteria,
                    requires_manual_review, review_completed, evaluated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    tender_id, bidder_id, overall, 0.0,
                    len(criteria),
                    sum(1 for r in criterion_results if r["verdict"] == "eligible"),
                    sum(1 for r in criterion_results if r["verdict"] == "not_eligible"),
                    sum(1 for r in criterion_results if r["verdict"] == "needs_review"),
                    any_needs_review, False,
                    datetime.utcnow(),
                ),
            )
            eval_id = cur.fetchone()[0]

            for r in criterion_results:
                cur.execute(
                    """
                    INSERT INTO criterion_evaluations (
                        evaluation_id, criterion_id, verdict, confidence,
                        requirement, bidder_value, comparison_detail,
                        source_document_id, source_page, source_excerpt,
                        reasoning, review_reason, manually_reviewed,
                        manual_verdict, reviewer_notes, reviewed_by,
                        reviewed_at, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        eval_id, r["criterion_id"], r["verdict"], r["confidence"],
                        r["description"], "", "", None,
                        r["source_page"], "",
                        r["reasoning"], None, False,
                        None, None, None, None,
                        datetime.utcnow(),
                    ),
                )

            cur.execute("UPDATE bidders SET status = 'evaluated' WHERE id = %s", (bidder_id,))
        conn.commit()

    logger.info(f"Single-bidder evaluation complete: bidder={bidder_id} overall={overall}")
    return {
        "evaluation_id": str(eval_id),
        "overall_verdict": overall,
        "total": len(criteria),
        "passed": sum(1 for r in criterion_results if r["verdict"] == "eligible"),
        "failed": sum(1 for r in criterion_results if r["verdict"] == "not_eligible"),
        "needs_review": sum(1 for r in criterion_results if r["verdict"] == "needs_review"),
        "criteria": criterion_results,
    }


# ----------------------------------------------------------------------
# Entry point for command‑line testing
# ----------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python evaluation_engine.py <tender_id>")
        sys.exit(1)
    tender_id = sys.argv[1]
    evaluate_tender(tender_id)