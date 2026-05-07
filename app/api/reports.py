from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import io
import sys
import os
import uuid

from app.database import get_db
from app.audit import log as audit_log
from app.config import REPORTS_DIR
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


@router.get("/{tender_id}/bidders/{bidder_id}/report")
async def generate_bidder_report(tender_id: str, bidder_id: str):
    from app.services.report_generator import ReportGenerator
    
    output_dir = "reports"
    os.makedirs(output_dir, exist_ok=True)
    
    generator = ReportGenerator()
    
    try:
        report = generator.generate_bidder_report(tender_id, bidder_id, output_dir)
        
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO reports (
                        id, tender_id, bidder_id, report_type, file_path, generated_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        str(uuid.uuid4()),
                        tender_id,
                        bidder_id,
                        "bidder_report",
                        report["pdf_path"],
                    ),
                )
                conn.commit()
            return report
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/{tender_id}/reports/all")
async def generate_all_bidder_reports(tender_id: str):
    from app.services.report_generator import ReportGenerator
    
    output_dir = "reports"
    os.makedirs(output_dir, exist_ok=True)
    
    generator = ReportGenerator()
    
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT id, company_name FROM bidders WHERE tender_id = %s",
                (tender_id,),
            )
            bidders = dict_fetchall(cur)
        
        generated_reports = []
        for bidder in bidders:
            try:
                report = generator.generate_bidder_report(tender_id, bidder["id"], output_dir)
                
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO reports (
                        id, tender_id, bidder_id, report_type, file_path, generated_at
                    ) VALUES (%s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        str(uuid.uuid4()),
                        tender_id,
                        bidder["id"],
                        "bidder_report",
                        report["pdf_path"],
                    ),
                )
                conn.commit()
                generated_reports.append(report)
            except Exception as e:
                generated_reports.append({
                    "bidder_id": bidder["id"],
                    "error": str(e)
                })
        
        return {"reports": generated_reports}
    finally:
        conn.close()


@router.get("/{tender_id}/matrix")
async def get_evaluation_matrix(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                "SELECT * FROM evaluation_matrix WHERE tender_id = %s",
                (tender_id,),
            )
            result = dict_fetchone(cur)
            if not result:
                return {"rankings": [], "message": "Matrix not yet generated"}
            return result
    finally:
        conn.close()


@router.post("/{tender_id}/matrix/refresh")
async def refresh_matrix(tender_id: str):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT 
                    b.id as bidder_id, b.company_name,
                    e.overall_verdict, e.score, e.requires_manual_review, e.review_completed
                FROM bidders b
                JOIN evaluations e ON b.id = e.bidder_id
                WHERE b.tender_id = %s
                ORDER BY e.score DESC NULLS LAST
                """,
                (tender_id,),
            )
            results = dict_fetchall(cur)
        
        rankings = []
        rank = 1
        for r in results:
            if r["overall_verdict"] != "not_eligible":
                rankings.append({
                    "rank": rank,
                    "bidder_id": r["bidder_id"],
                    "bidder_name": r["company_name"],
                    "overall_verdict": r["overall_verdict"],
                    "score": r["score"] or 0,
                    "requires_review": r["requires_manual_review"],
                    "review_completed": r["review_completed"]
                })
                rank += 1
        
        eligible_count = sum(1 for r in results if r["overall_verdict"] == "eligible")
        ineligible_count = sum(1 for r in results if r["overall_verdict"] == "not_eligible")
        review_count = sum(1 for r in results if r["overall_verdict"] == "needs_review")
        
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evaluation_matrix (
                    id, tender_id, total_bidders, eligible_count, ineligible_count,
                    review_count, rankings, all_reviews_complete, generated_at, last_updated
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (tender_id) DO UPDATE SET
                    total_bidders = EXCLUDED.total_bidders,
                    eligible_count = EXCLUDED.eligible_count,
                    ineligible_count = EXCLUDED.ineligible_count,
                    review_count = EXCLUDED.review_count,
                    rankings = EXCLUDED.rankings,
                    last_updated = NOW()
                """,
                (
                    str(uuid.uuid4()),
                    tender_id,
                    len(results),
                    eligible_count,
                    ineligible_count,
                    review_count,
                    psycopg2.extras.Json(rankings),
                    review_count == 0,
                ),
            )
            conn.commit()
        
        return {"message": "Matrix refreshed", "rankings": rankings}
    finally:
        conn.close()


@router.get("/{tender_id}/matrix/export")
async def export_matrix(tender_id: str, format: str = "json"):
    """Export the evaluation matrix as JSON or CSV."""
    import csv

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(
                """
                SELECT
                    b.id as bidder_id, b.company_name,
                    e.overall_verdict, e.score, e.evaluated_at,
                    json_agg(
                        json_build_object(
                            'criterion', c.description,
                            'verdict', ce.verdict,
                            'confidence', ce.confidence
                        )
                    ) as criterion_evaluations
                FROM bidders b
                JOIN evaluations e ON b.id = e.bidder_id
                JOIN criterion_evaluations ce ON e.id = ce.evaluation_id
                JOIN criteria c ON ce.criterion_id = c.id
                WHERE b.tender_id = %s
                GROUP BY b.id, b.company_name, e.overall_verdict, e.score, e.evaluated_at
                ORDER BY e.score DESC NULLS LAST
                """,
                (tender_id,),
            )
            results = dict_fetchall(cur)
    finally:
        conn.close()

    if format.lower() == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["bidder_id", "company_name", "overall_verdict", "score", "evaluated_at"])
        for r in results:
            writer.writerow([r["bidder_id"], r["company_name"], r["overall_verdict"], r.get("score"), r.get("evaluated_at")])
        return StreamingResponse(
            iter([buf.getvalue()]), media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="matrix-{tender_id}.csv"'},
        )

    return {"matrix": results, "format": format}


# ---------------------------------------------------------------------------
# Consolidated tender report — all bidders in a single signable PDF
# ---------------------------------------------------------------------------


def _verdict_class(v: str) -> str:
    return {
        "eligible": "v-pass",
        "not_eligible": "v-fail",
        "needs_review": "v-review",
    }.get(v, "v-other")


def _verdict_label(v: str) -> str:
    return {
        "eligible": "Eligible",
        "not_eligible": "Not Eligible",
        "needs_review": "Manual Review",
    }.get(v, v.title() if v else "—")


def _build_consolidated_html(tender, criteria, bidders, evaluations, criterion_evals, audit_events) -> str:
    """Render the consolidated report as a single HTML string."""
    counts = {"eligible": 0, "not_eligible": 0, "needs_review": 0}
    for e in evaluations:
        counts[e["overall_verdict"]] = counts.get(e["overall_verdict"], 0) + 1

    rows_html = []
    for idx, b in enumerate(bidders, start=1):
        ev = next((e for e in evaluations if e["bidder_id"] == b["id"]), None)
        verdict = ev["overall_verdict"] if ev else "—"
        score = ev.get("score") if ev else "—"
        rows_html.append(
            f"""
            <tr>
              <td class="num">{idx:02d}</td>
              <td>{b.get('company_name','')}</td>
              <td class="mono">{b.get('registration_number') or '—'}</td>
              <td class="mono">{score if score is not None else '—'}</td>
              <td><span class="verdict {_verdict_class(verdict)}">{_verdict_label(verdict)}</span></td>
            </tr>
            """
        )

    crit_html = []
    for c in criteria:
        crit_html.append(
            f"<tr><td class='mono'>{c.get('criterion_code') or ''}</td>"
            f"<td>{c.get('description') or ''}</td>"
            f"<td>{c.get('priority') or ''}</td>"
            f"<td>{c.get('threshold_operator') or ''} {c.get('threshold_value') or ''} {c.get('unit') or ''}</td></tr>"
        )

    audit_html = []
    for a in audit_events[:50]:
        audit_html.append(
            f"<tr><td class='mono'>{a['timestamp']}</td>"
            f"<td>{a['actor_label']}</td>"
            f"<td class='mono'>{a['actor_role']}</td>"
            f"<td>{a['action']}</td>"
            f"<td class='mono'>{(a.get('hash') or '')[:12]}…</td></tr>"
        )

    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Consolidated Evaluation Report — {tender['tender_number']}</title>
<style>
@page {{ size: A4; margin: 18mm 16mm; }}
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #14213d; font-size: 10pt; }}
h1 {{ font-size: 18pt; margin: 0 0 4pt; }}
h2 {{ font-size: 12pt; margin: 16pt 0 6pt; border-bottom: 1px solid #c9d3e3; padding-bottom: 3pt; }}
.muted {{ color: #6b7280; }}
.mono {{ font-family: 'Courier New', monospace; font-size: 9pt; }}
.header-strip {{ background:#0a2540; color:#fff; padding:14pt 16pt; border-radius:6pt; }}
.header-strip .ref {{ font-family: monospace; font-size: 9pt; opacity: .85; }}
.figs {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt; margin-top: 10pt; }}
.fig {{ border: 1px solid #e2e8f0; padding: 10pt; border-radius: 4pt; }}
.fig .lbl {{ font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color:#6b7280; }}
.fig .val {{ font-size: 18pt; font-weight: 600; }}
.fig.v-pass .val {{ color: #15803d; }}
.fig.v-fail .val {{ color: #b91c1c; }}
.fig.v-review .val {{ color: #b45309; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 8pt; }}
th, td {{ text-align: left; padding: 5pt 6pt; border-bottom: 1px solid #e5e7eb; vertical-align: top; }}
th {{ background: #f1f5f9; font-size: 9pt; text-transform: uppercase; letter-spacing: .03em; color: #475569; }}
.num {{ width: 30pt; color: #6b7280; }}
.verdict {{ display: inline-block; padding: 2pt 6pt; border-radius: 3pt; font-size: 8.5pt; font-weight: 600; }}
.verdict.v-pass {{ background: #ecfdf5; color: #15803d; }}
.verdict.v-fail {{ background: #fef2f2; color: #b91c1c; }}
.verdict.v-review {{ background: #fffbeb; color: #b45309; }}
.verdict.v-other {{ background: #f1f5f9; color: #475569; }}
.signoff {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12pt; margin-top: 14pt; }}
.signoff .box {{ border-top: 1px dashed #94a3b8; padding-top: 6pt; min-height: 50pt; }}
.signoff .name {{ font-weight: 600; font-size: 10pt; }}
.signoff .role {{ color: #6b7280; font-size: 9pt; }}
.footer {{ margin-top: 18pt; padding-top: 6pt; border-top: 1px solid #e2e8f0; color:#6b7280; font-size: 8.5pt; }}
</style></head><body>

<div class="header-strip">
  <div class="muted" style="opacity:.85; font-size:8.5pt; text-transform:uppercase; letter-spacing:.06em;">
    Government of India · Ministry of Home Affairs · CRPF
  </div>
  <h1>Consolidated Evaluation Report</h1>
  <div>{tender.get('title','')}</div>
  <div class="ref">{tender.get('tender_number','')}</div>
</div>

<div class="figs">
  <div class="fig"><div class="lbl">Bidders Evaluated</div><div class="val">{len(bidders)}</div></div>
  <div class="fig v-pass"><div class="lbl">Recommended for Award</div><div class="val">{counts.get('eligible',0)}</div></div>
  <div class="fig v-review"><div class="lbl">Manual Review Pending</div><div class="val">{counts.get('needs_review',0)}</div></div>
</div>

<h2>Section A — Bidder-wise Verdict</h2>
<table>
  <thead><tr><th>#</th><th>Bidder</th><th>Reg. no.</th><th>Score</th><th>Verdict</th></tr></thead>
  <tbody>{''.join(rows_html)}</tbody>
</table>

<h2>Section B — Eligibility Criteria</h2>
<table>
  <thead><tr><th>Code</th><th>Description</th><th>Priority</th><th>Threshold</th></tr></thead>
  <tbody>{''.join(crit_html)}</tbody>
</table>

<h2>Section C — Audit Trail (latest 50)</h2>
<table>
  <thead><tr><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Hash</th></tr></thead>
  <tbody>{''.join(audit_html)}</tbody>
</table>

<h2>Section D — Sign-off</h2>
<div class="signoff">
  <div class="box"><div class="name">Procurement Officer</div><div class="role">Inspector, Procurement Wing</div></div>
  <div class="box"><div class="name">Recommending Authority</div><div class="role">Commandant</div></div>
  <div class="box"><div class="name">Approving Authority</div><div class="role">DIG (Procurement)</div></div>
</div>

<div class="footer">
  Generated {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')} · This report is digitally signed and tamper-evident
  via the SHA-256 audit chain. Verify at <span class="mono">/api/audit/verify</span>.
</div>

</body></html>
"""


@router.get("/{tender_id}/report.pdf")
async def consolidated_tender_report(tender_id: str):
    """Build a single PDF that summarises the whole tender — bidder verdicts,
    criteria, audit trail and sign-off blocks. Suitable for officer signature."""
    from weasyprint import HTML

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM tenders WHERE id = %s", (tender_id,))
            tender = dict_fetchone(cur)
            if not tender:
                raise HTTPException(status_code=404, detail="Tender not found")

            cur.execute(
                "SELECT * FROM criteria WHERE tender_id = %s ORDER BY criterion_code",
                (tender_id,),
            )
            criteria = dict_fetchall(cur)

            cur.execute(
                "SELECT * FROM bidders WHERE tender_id = %s ORDER BY company_name",
                (tender_id,),
            )
            bidders = dict_fetchall(cur)

            cur.execute(
                "SELECT * FROM evaluations WHERE tender_id = %s",
                (tender_id,),
            )
            evals = dict_fetchall(cur)

            cur.execute(
                """
                SELECT ce.*
                FROM criterion_evaluations ce
                JOIN evaluations e ON ce.evaluation_id = e.id
                WHERE e.tender_id = %s
                ORDER BY ce.created_at
                """,
                (tender_id,),
            )
            cevals = dict_fetchall(cur)

            cur.execute(
                """
                SELECT * FROM audit_events
                WHERE target_type IN ('tender','bidder','criterion_evaluation','tender_document','bidder_document')
                  AND (
                    target_id = %s::uuid
                    OR target_id IN (SELECT id FROM bidders WHERE tender_id = %s)
                    OR target_id IN (
                        SELECT ce.id FROM criterion_evaluations ce
                        JOIN evaluations e ON ce.evaluation_id = e.id
                        WHERE e.tender_id = %s
                    )
                  )
                ORDER BY timestamp DESC
                LIMIT 50
                """,
                (tender_id, tender_id, tender_id),
            )
            audit_events = dict_fetchall(cur)
    finally:
        conn.close()

    html = _build_consolidated_html(tender, criteria, bidders, evals, cevals, audit_events)

    os.makedirs(REPORTS_DIR, exist_ok=True)
    filename = f"tender-{tender_id}-consolidated-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.pdf"
    pdf_path = os.path.join(REPORTS_DIR, filename)
    HTML(string=html).write_pdf(pdf_path)

    # Record in reports table for audit
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reports (id, tender_id, bidder_id, report_type, file_path, generated_at)
                VALUES (%s, %s, NULL, 'consolidated', %s, NOW())
                """,
                (str(uuid.uuid4()), tender_id, pdf_path),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=None, actor_role="officer", actor_label="Officer",
        action="report.consolidated.generated",
        target_type="tender", target_id=tender_id,
        detail={"file": pdf_path, "bidders": len(bidders)},
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=filename,
    )