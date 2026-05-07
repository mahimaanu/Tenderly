#!/usr/bin/env bash
# Run all SQL migrations in order against $DATABASE_URL (or DB_URL from db_connection.py).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  # Fall back to the URL hard-coded in app/db_connection.py
  DATABASE_URL=$(python -c 'from app.db_connection import DB_URL; print(DB_URL)')
fi

echo "Applying migrations against ${DATABASE_URL%%@*}@…"

for f in "$DIR"/*.sql; do
  echo "  → $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✓ Migrations complete."
