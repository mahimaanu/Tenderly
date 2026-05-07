"""
Shared psycopg2 helpers — single place for connections, dict cursor adapters,
and small utilities. Endpoints should `from app.db import get_conn, dict_one,
dict_all` instead of redefining these locally.
"""

from contextlib import contextmanager
from typing import Iterator
import psycopg2
import psycopg2.extras

from .config import DATABASE_URL


def get_conn():
    """Open a new psycopg2 connection. Caller is responsible for closing it."""
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def conn_ctx() -> Iterator[psycopg2.extensions.connection]:
    """Context-managed connection — auto-commits on success, rolls back on error."""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def dict_all(cursor) -> list[dict]:
    """Convert all cursor rows to list of dicts (cursor must use no factory or DictCursor)."""
    if not cursor.description:
        return []
    columns = [c[0] for c in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def dict_one(cursor) -> dict | None:
    row = cursor.fetchone()
    if row is None:
        return None
    columns = [c[0] for c in cursor.description]
    return dict(zip(columns, row))


def with_dict_cursor(conn):
    """Return a DictCursor for convenience."""
    return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
