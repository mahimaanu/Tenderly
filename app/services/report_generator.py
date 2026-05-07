"""
Individual Bidder Report Generator
- Fetches evaluation data from the database for a given tender and bidder
- Generates an HTML report using a Jinja2 template
- Converts the HTML to PDF using WeasyPrint
- Stores the report in the specified output directory and returns report metadata
"""

import os
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

# Import from parent directory
from ..db_connection import DB_URL  # type: ignore
import psycopg2
import psycopg2.extras
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML, CSS

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
# Report Generator Class
# ----------------------------------------------------------------------
class ReportGenerator:
    def __init__(self, template_dir: str = "templates"):
        """
        Initialize the report generator with a template directory.
        If the directory does not exist, we will use a built-in template string.
        """
        self.template_dir = template_dir
        if os.path.isdir(template_dir):
            self.env = Environment(
                loader=FileSystemLoader(template_dir),
                autoescape=select_autoescape(['html', 'xml'])
            )
        else:
            self.env = None
            # We'll define a default template string below
            self.default_template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Bidder Report: {{ bidder_name }}</title>
                <style>
                {{ report_css }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Tender Eligibility Evaluation Report</h1>
                    <p><strong>Tender:</strong> {{ tender_title }} ({{ tender_id }})</p>
                    <p><strong>Bidder:</strong> {{ bidder_name }}</p>
                    <p><strong>Evaluation Date:</strong> {{ evaluated_at }}</p>
                </div>
                
                <div class="verdict-box verdict-{{ overall_verdict | lower }}">
                    <h2>Overall Verdict: {{ overall_verdict | upper }} </h2>
                    <p>Score: {{ score }}/100</p>
                </div>
                
                <h2>Criterion-wise Evaluation</h2>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Criterion</th>
                            <th>Priority</th>
                            <th>Verdict</th>
                            <th>Requirement</th>
                            <th>Bidder Value</th>
                            <th>Evidence</th>
                            <th>Reasoning</th>
                        </tr>
                    </thead>
                    <tbody>
                    {% for eval in criterion_evaluations %}
                        <tr class="criterion-{{ eval.verdict | lower }}">
                            <td>{{ loop.index }}</td>
                            <td>{{ eval.criterion_description }}</td>
                            <td>{{ eval.priority }}</td>
                            <td class="verdict-{{ eval.verdict | lower }}">{{ eval.verdict | upper }}</td>
                            <td>{{ eval.requirement }}</td>
                            <td>{{ eval.bidder_value }}</td>
                            <td>
                                {% if eval.source_document %}
                                    {{ eval.source_document }}, Page {{ eval.source_page }}
                                {% else %}
                                    N/A
                                {% endif %}
                            </td>
                            <td>{{ eval.reasoning }}</td>
                        </tr>
                    {% endfor %}
                    </tbody>
                </table>
                
                <div class="audit-section">
                    <h2>Audit Trail</h2>
                    <p><strong>Report Generated:</strong> {{ generated_at }}</p>
                    <p><strong>Evaluation Completed:</strong> {{ evaluation_completed_at }}</p>
                </div>
            </body>
            </html>
            """

    def _get_report_css(self) -> str:
        """Return the CSS string for the report (as per prototype_design.md)."""
        return """
        body { font-family: 'Arial', sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .verdict-eligible { color: #22c55e; }
        .verdict-ineligible { color: #ef4444; }
        .verdict-review { color: #f59e0b; }
        .verdict-box {
            border: 2px solid #ccc;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            border-radius: 5px;
        }
        .verdict-box.verdict-eligible { background-color: #dcfce7; border-color: #22c55e; }
        .verdict-box.verdict-ineligible { background-color: #fee2e2; border-color: #ef4444; }
        .verdict-box.verdict-review { background-color: #fef3c7; border-color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f3f4f6; }
        .criterion-eligible { background: #dcfce7; }
        .criterion-ineligible { background: #fee2e2; }
        .criterion-review { background: #fef3c7; }
        .evidence-box { background: #f9fafb; padding: 10px; margin: 5px 0; font-size: 0.9em; }
        .audit-section { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
        """

    def _fetch_tender_info(self, tender_id: str) -> Dict:
        """Fetch tender information from the database."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, tender_number, title, description, issuing_authority,
                           submission_deadline, status, created_at
                    FROM tenders
                    WHERE id = %s
                    """,
                    (tender_id,),
                )
                row = dict_fetchone(cur)
                if row is None:
                    raise ValueError(f"Tender with ID {tender_id} not found")
                return dict(row)

    def _fetch_bidder_info(self, bidder_id: str) -> Dict:
        """Fetch bidder information from the database."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, company_name, contact_email, registration_number,
                           submitted_at, status
                    FROM bidders
                    WHERE id = %s
                    """,
                    (bidder_id,),
                )
                row = dict_fetchone(cur)
                if row is None:
                    raise ValueError(f"Bidder with ID {bidder_id} not found")
                return dict(row)

    def _fetch_evaluation(self, tender_id: str, bidder_id: str) -> Dict:
        """Fetch the evaluation record for the given tender and bidder."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, overall_verdict, score, total_criteria,
                           passed_criteria, failed_criteria, review_criteria,
                           requires_manual_review, review_completed,
                           evaluated_at, created_at
                    FROM evaluations
                    WHERE tender_id = %s AND bidder_id = %s
                    """,
                    (tender_id, bidder_id),
                )
                row = dict_fetchone(cur)
                if row is None:
                    raise ValueError(f"No evaluation found for tender {tender_id} and bidder {bidder_id}")
                return dict(row)

    def _fetch_criterion_evaluations(self, evaluation_id: str) -> List[Dict]:
        """Fetch criterion evaluations for a given evaluation ID, joined with criteria for details."""
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT ce.id, ce.verdict, ce.confidence, ce.requirement, ce.bidder_value,
                           ce.comparison_detail, ce.reasoning, ce.source_document_id,
                           ce.source_page, ce.source_excerpt,
                           c.description AS criterion_description,
                           c.type AS criterion_type,
                           c.priority AS criterion_priority,
                           c.original_text,
                           b.filename AS source_document
                    FROM criterion_evaluations ce
                    JOIN criteria c ON ce.criterion_id = c.id
                    LEFT JOIN bidder_documents b ON ce.source_document_id = b.id
                    WHERE ce.evaluation_id = %s
                    ORDER BY ce.id
                    """,
                    (evaluation_id,),
                )
                return dict_fetchall(cur)

    def generate_bidder_report(self, tender_id: str, bidder_id: str, output_dir: str) -> Dict[str, Any]:
        """
        Generate a PDF report for a specific bidder in a tender.
        
        Args:
            tender_id: The ID of the tender.
            bidder_id: The ID of the bidder.
            output_dir: Directory where the PDF report will be saved.
        
        Returns:
            A dictionary containing the report metadata (report_id, file paths, etc.).
        """
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Fetch data from the database
        tender_info = self._fetch_tender_info(tender_id)
        bidder_info = self._fetch_bidder_info(bidder_id)
        evaluation = self._fetch_evaluation(tender_id, bidder_id)
        criterion_evaluations = self._fetch_criterion_evaluations(evaluation['id'])
        
        # Prepare data for the template
        template_data = {
            'tender_id': tender_info['id'],
            'tender_number': tender_info['tender_number'],
            'tender_title': tender_info['title'],
            'tender_description': tender_info['description'],
            'issuing_authority': tender_info['issuing_authority'],
            'submission_deadline': tender_info['submission_deadline'],
            'tender_status': tender_info['status'],
            'tender_created_at': tender_info['created_at'],
            
            'bidder_id': bidder_info['id'],
            'bidder_name': bidder_info['company_name'],
            'bidder_contact_email': bidder_info['contact_email'],
            'bidder_registration_number': bidder_info['registration_number'],
            'bidder_submitted_at': bidder_info['submitted_at'],
            'bidder_status': bidder_info['status'],
            
            'evaluation_id': evaluation['id'],
            'overall_verdict': evaluation['overall_verdict'],
            'score': evaluation['score'],
            'total_criteria': evaluation['total_criteria'],
            'passed_criteria': evaluation['passed_criteria'],
            'failed_criteria': evaluation['failed_criteria'],
            'review_criteria': evaluation['review_criteria'],
            'requires_manual_review': evaluation['requires_manual_review'],
            'review_completed': evaluation['review_completed'],
            'evaluated_at': evaluation['evaluated_at'],
            'evaluation_created_at': evaluation['created_at'],
            
            'criterion_evaluations': [
                {
                    'criterion_description': row['criterion_description'],
                    'priority': row['criterion_priority'],
                    'verdict': row['verdict'],
                    'confidence': row['confidence'],
                    'requirement': row['requirement'],
                    'bidder_value': row['bidder_value'],
                    'comparison_detail': row['comparison_detail'],
                    'reasoning': row['reasoning'],
                    'source_document': row['source_document'],
                    'source_page': row['source_page'],
                    'source_excerpt': row['source_excerpt']
                }
                for row in criterion_evaluations
            ],
            
            'generated_at': datetime.utcnow(),
        }
        
        # Render the template
        if self.env:
            # Use the template from the file system
            template = self.env.get_template("bidder_report.html")
            html_content = template.render(**template_data)
        else:
            # Use the default template string
            from jinja2 import Template
            template = Template(self.default_template)
            html_content = template.render(**template_data, report_css=self._get_report_css())
        
        # Generate PDF
        pdf_filename = f"Report_{bidder_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)
        
        HTML(string=html_content).write_pdf(
            pdf_path,
            stylesheets=[CSS(string=self._get_report_css())]
        )
        
        # Return report metadata
        return {
            'report_id': f"RPT_{bidder_id}_{int(datetime.utcnow().timestamp())}",
            'tender_id': tender_id,
            'bidder_id': bidder_id,
            'evaluation_id': evaluation['id'],
            'html_content': html_content,
            'pdf_path': pdf_path,
            'generated_at': datetime.utcnow()
        }

# ----------------------------------------------------------------------
# Example usage (for testing)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python report_generator.py <tender_id> <bidder_id> <output_dir>")
        sys.exit(1)
    
    tender_id = sys.argv[1]
    bidder_id = sys.argv[2]
    output_dir = sys.argv[3]
    
    generator = ReportGenerator()
    try:
        report = generator.generate_bidder_report(tender_id, bidder_id, output_dir)
        print(f"Report generated successfully:")
        print(f"  PDF Path: {report['pdf_path']}")
        print(f"  Report ID: {report['report_id']}")
    except Exception as e:
        print(f"Error generating report: {e}")
        sys.exit(1)