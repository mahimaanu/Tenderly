# Tender Evaluation System API

FastAPI backend for AI-based tender evaluation and eligibility analysis.

## Project Structure

```
app/
├── main.py              # FastAPI application entry point
├── database.py          # Database connection setup
├── api/
│   ├── __init__.py
│   ├── tenders.py       # Tender management endpoints
│   ├── bidders.py       # Bidder management endpoints
│   ├── evaluations.py   # Evaluation endpoints
│   └── reports.py       # Report generation endpoints
├── schemas/
│   ├── tender.py        # Tender schemas
│   ├── bidder.py        # Bidder schemas
│   └── evaluation.py    # Evaluation schemas
├── services/            # Business logic (coming soon)
├── models/              # SQLAlchemy models (coming soon)
└── templates/
    └── bidder_report.html
```

## API Endpoints

### Tender Management
- `POST /api/tenders` - Create a new tender
- `POST /api/tenders/{tender_id}/upload` - Upload tender document
- `GET /api/tenders/{tender_id}` - Get tender details
- `GET /api/tenders/` - List all tenders
- `GET /api/tenders/{tender_id}/criteria` - Get extracted criteria
- `PUT /api/tenders/{tender_id}/criteria/{criterion_id}` - Update criterion
- `POST /api/tenders/{tender_id}/criteria/confirm` - Confirm criteria

### Bidder Management
- `POST /api/tenders/{tender_id}/bidders` - Add a bidder
- `GET /api/tenders/{tender_id}/bidders` - List bidders
- `POST /api/tenders/{tender_id}/bidders/{bidder_id}/documents` - Upload bidder documents

### Evaluation
- `POST /api/tenders/{tender_id}/evaluate` - Start evaluation
- `GET /api/tenders/{tender_id}/evaluations` - Get all evaluations
- `GET /api/tenders/{tender_id}/bidders/{bidder_id}/evaluation` - Get bidder evaluation
- `GET /api/tenders/{tender_id}/reviews/pending` - Get pending reviews
- `POST /api/criterion-evaluations/{eval_id}/review` - Submit manual review

### Reports
- `GET /api/tenders/{tender_id}/bidders/{bidder_id}/report` - Generate bidder report
- `GET /api/tenders/{tender_id}/reports/all` - Generate all reports
- `GET /api/tenders/{tender_id}/matrix` - Get evaluation matrix
- `POST /api/tenders/{tender_id}/matrix/refresh` - Refresh matrix

## Installation

```bash
pip install fastapi uvicorn psycopg2-binary python-multipart python-jose
```

## Running the Server

```bash
uvicorn app.main:app --reload
```

API documentation available at http://localhost:8000/docs