.DEFAULT_GOAL := help

-include .env
export

PSQL := $(shell command -v psql 2>/dev/null || echo "/opt/homebrew/opt/postgresql@18/bin/psql")

.PHONY: help install frontend backend db db-stop migrate seed dev

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install    Install Python + Node dependencies"
	@echo "  frontend   Start Next.js frontend  (http://localhost:3000)"
	@echo "  backend    Start FastAPI backend    (http://localhost:8000)"
	@echo "  db         Start local Postgres via Docker (port 5432)"
	@echo "  db-stop    Stop local Postgres container"
	@echo "  migrate    Run all numbered SQL migrations in order"
	@echo "  seed       Load seed data (app/migrations/seed.sql)"
	@echo "  dev        Start backend + frontend together"

install:
	pip install -r requirements.txt
	cd tenderly-ui && npm install

frontend:
	cd tenderly-ui && npm run dev

backend:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

db:
	docker run -d --name tenderly-db \
		-e POSTGRES_USER=postgres \
		-e POSTGRES_PASSWORD=postgres \
		-e POSTGRES_DB=tenderly \
		-p 5432:5432 \
		postgres:16-alpine 2>/dev/null || docker start tenderly-db
	@echo "Postgres running at postgresql://postgres:postgres@localhost:5432/tenderly"

db-stop:
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
	fi
	$(PSQL) "$(DATABASE_URL)" -f app/migrations/seed.sql
	@echo "Seed data loaded."

dev:
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait
