# Tender Evaluation System

AI-Based Tender Evaluation and Eligibility Analysis Platform for Government Procurement.

## Quick Start

To start Front End :
See [`SETUP.md`](./tenderly-ui/SETUP.md) for full setup instructions.
```
npm run install
npm run dev
```

To start Backend :

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload
```

## API Documentation

Once running, visit http://localhost:8000/docs for interactive API documentation.

## Directory Structure

```
Tenderly/
├── app/                          # FastAPI application
│   ├── main.py                   # Application entry point
│   ├── database.py               # Database connection
│   ├── api/                      # API endpoints
│   │   ├── tenders.py
│   │   ├── bidders.py
│   │   ├── evaluations.py
│   │   └── reports.py
│   ├── schemas/                  # Pydantic models
│   ├── services/                 # Business logic wrappers
│   └── templates/                # Report templates
├── docs/                         # Documentation
│   ├── prototype_design.md
│   ├── detailed_design.md
│   └── plan.md
├── templates/                    # Jinja2 templates
├── uploads/                      # Uploaded documents
├── reports/                      # Generated reports
├── ingestion.py                  # Document processing
├── evaluation_engine.py          # Evaluation logic
├── report_generator.py           # Report generation
├── db_connection.py              # Database config
└── tenderly.sql                  # Database schema
```
