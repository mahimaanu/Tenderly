import os
import sys
import urllib.parse


# Ensure .env is loaded even if this module is imported standalone (e.g. by
# migration scripts or one-off tools that don't go through app.main).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except ImportError:
    pass

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in your "
        "Postgres connection string, or export DATABASE_URL in your shell."
    )


def test_with_psycopg2(url):
    import psycopg2
    parsed = urllib.parse.urlparse(url)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password,
        connect_timeout=10
    )
    cur = conn.cursor()
    cur.execute("SELECT version();")
    version = cur.fetchone()[0]
    cur.close()
    conn.close()
    return version

def test_with_psycopg3(url):
    import psycopg
    conn = psycopg.connect(url, connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT version();")
    version = cur.fetchone()[0]
    cur.close()
    conn.close()
    return version

def test_with_sqlalchemy(url):
    from sqlalchemy import create_engine, text
    engine = create_engine(url, connect_args={'connect_timeout': 10}, pool_pre_ping=True)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version();"))
        version = result.fetchone()[0]
    engine.dispose()
    return version

def main():
    methods = [
        ("psycopg2", test_with_psycopg2),
        ("psycopg (v3)", test_with_psycopg3),
        ("sqlalchemy", test_with_sqlalchemy),
    ]

    for name, fn in methods:
        try:
            print(f"Testing connection using {name}...")
            version = fn(DB_URL)
            print(f"Connected successfully via {name}!")
            print(f"PostgreSQL version: {version}")
            return 0
        except ImportError as e:
            print(f" {name} not available: {e}")
        except Exception as e:
            print(f"Connection failed with {name}: {e}")

    print("\nAll connection methods failed. Ensure psycopg2-binary or psycopg is installed:")
    print("  pip install psycopg2-binary")
    print("  or")
    print("  pip install psycopg[binary]")
    return 1

if __name__ == "__main__":
    sys.exit(main())
