# Tender Evaluation System

AI-Based Tender Evaluation and Eligibility Analysis Platform for Government Procurement.

## Quick Start

1. Copy the environment file and configure your database URL:
   ```bash
   cp .env.example .env
   # edit .env and set DATABASE_URL
   ```

2. Install all dependencies:
   ```bash
   make install
   ```

3. Run database migrations:
   ```bash
   make migrate
   ```

4. (Optional) Load seed data:
   ```bash
   make seed
   ```

5. Start the full stack:
   ```bash
   make dev
   ```

## Makefile Commands

| Command | Description |
|---|---|
| `make install` | Install Python + Node dependencies |
| `make frontend` | Start Next.js frontend at http://localhost:3000 |
| `make backend` | Start FastAPI backend at http://localhost:8000 |
| `make db` | Start a local Postgres 16 container via Docker (port 5432) |
| `make db-stop` | Stop the local Postgres container |
| `make migrate` | Run all SQL migrations in order against `$DATABASE_URL` |
| `make seed` | Load seed data from `app/migrations/seed.sql` |
| `make dev` | Start backend + frontend together (Ctrl+C stops both) |

> `DATABASE_URL` is read from `.env` automatically. Set it before running `migrate` or `seed`.

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
