"""
Sets up the SQLite database end-to-end: creates tables from the models,
loads the raw CSV into `orders`, then runs the SQL pipeline
(cleaning.sql -> eda.sql -> etl.sql) to build the derived tables.

Safe to re-run: table creation and the SQL scripts are idempotent, and the
CSV load is skipped if `orders` is already populated.

Usage: python -m ecommerce_sales_analysis.setup_db
"""

from pathlib import Path

import pandas as pd
from sqlalchemy import inspect, text

from ecommerce_sales_analysis.db.engine import create_tables, engine

REPO_ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = REPO_ROOT / "sql"
CSV_PATH = REPO_ROOT / "data" / "synthetic_ecommerce_sales_2025.csv"


def run_sql_script(path: Path):
    """Runs a .sql file that may contain multiple statements."""
    raw_conn = engine.raw_connection()
    try:
        raw_conn.executescript(path.read_text())
        raw_conn.commit()
    finally:
        raw_conn.close()
    print(f"Ran {path.relative_to(REPO_ROOT)}")


def load_orders_csv():
    if inspect(engine).has_table("orders"):
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM orders")).scalar()
        if count:
            print(f"orders already has {count} rows, skipping CSV load")
            return

    df = pd.read_csv(CSV_PATH)
    df.to_sql("orders", engine, if_exists="append", index=False)
    print(f"Loaded {len(df)} rows into orders")


def db_is_ready() -> bool:
    """Whether the tables the app actually queries at runtime already exist."""
    inspector = inspect(engine)
    return inspector.has_table("orders_cleaned") and inspector.has_table(
        "monthly_kpis_with_mom"
    )


def ensure_db():
    """
    Builds the database if it isn't set up yet, otherwise does nothing.
    Meant to be called on app startup (e.g. on a fresh Streamlit Cloud
    container) so the db is built from the committed CSV on first run.
    """
    if db_is_ready():
        print("Database already set up, skipping.")
        return
    main()


def main():
    print("1. Creating tables from models...")
    create_tables()

    print("2. Loading orders CSV...")
    load_orders_csv()

    print("3. Running cleaning.sql (builds orders_cleaned)...")
    run_sql_script(SQL_DIR / "cleaning.sql")

    print("4. Running eda.sql (builds monthly_kpis_with_mom)...")
    run_sql_script(SQL_DIR / "eda.sql")

    print("5. Running etl.sql (populates star schema)...")
    run_sql_script(SQL_DIR / "etl.sql")

    print("Database setup complete.")


if __name__ == "__main__":
    main()
