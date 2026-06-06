.DEFAULT_GOAL := help

-include .env
export

VENV   := venv
PYTHON := $(VENV)/bin/python
PIP    := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PSQL   := $(shell command -v psql 2>/dev/null || echo "/opt/homebrew/opt/postgresql@18/bin/psql")

.PHONY: help install frontend backend db db-stop migrate seed dev venv

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install    Create venv (if needed) and install Python + Node dependencies"
	@echo "  frontend   Start Next.js frontend  (http://localhost:3000)"
	@echo "  backend    Start FastAPI backend    (http://localhost:8000)"
	@echo "  db         Start local Postgres via Docker (port 5432)"
	@echo "  db-stop    Stop local Postgres container"
	@echo "  migrate    Run all numbered SQL migrations in order"
	@echo "  seed       Load seed data (app/migrations/seed.sql)"
	@echo "  dev        Start backend + frontend together"

venv:
	@if [ ! -f "$(VENV)/bin/python" ]; then \
		echo "Creating virtual environment…"; \
		python3 -m venv $(VENV); \
	fi

install: venv
	$(PIP) install -r requirements.txt
	cd tenderly-ui && npm install

frontend:
	cd tenderly-ui && npm run dev

backend:
	$(UVICORN) app.main:app --host 0.0.0.0 --port 8000 --reload

db:
	@command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/"; exit 1; }
	docker run -d --name tenderly-db \
		-e POSTGRES_USER=postgres \
		-e POSTGRES_PASSWORD=postgres \
		-e POSTGRES_DB=tenderly \
		-p 5432:5432 \
		postgres:16-alpine 2>/dev/null || docker start tenderly-db
	@echo "Postgres running at postgresql://postgres:postgres@localhost:5432/tenderly"

db-stop:
	@command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is not installed."; exit 1; }
	docker stop tenderly-db

migrate:
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is not set. Copy .env.example to .env and configure it."; exit 1; \
	fi
	@for f in app/migrations/[0-9]*.sql; do \
		echo "  → $$f"; \
		$(PSQL) "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -f "$$f"; \
	done
	@echo "Migrations complete."

seed:
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is not set. Copy .env.example to .env and configure it."; exit 1; \
	elif [ ! -f app/migrations/seed.sql ]; then \
		echo "No seed.sql found — skipping."; \
	else \
		$(PSQL) "$(DATABASE_URL)" -f app/migrations/seed.sql && echo "Seed data loaded."; \
	fi

dev: venv
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait
