"""
scripts/run_sql.py - run one or more .sql files against DATABASE_URL (from .env).

Usage (from the project root, venv active):
    python scripts/run_sql.py sql/01_schema_pg.sql sql/02_seed_data.sql sql/03_seed_extra.sql sql/04_advanced_pg.sql

Note: 05_queries.sql is a demo script to paste into the Neon SQL Editor / psql,
not to run with this tool.
"""
import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL", "")
if not url:
    sys.exit("DATABASE_URL is not set (copy .env.example to .env first).")
if url.startswith("postgresql+psycopg2://"):
    url = "postgresql://" + url[len("postgresql+psycopg2://"):]

if len(sys.argv) < 2:
    sys.exit(__doc__)

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
for path in sys.argv[1:]:
    with open(path, encoding="utf-8") as fh:
        sql = fh.read()
    try:
        cur.execute(sql)
        print(f"OK   {path}")
    except Exception as exc:                     # noqa: BLE001
        print(f"FAIL {path}\n     {str(exc).strip().splitlines()[0]}")
        sys.exit(1)
conn.close()
print("Done.")
