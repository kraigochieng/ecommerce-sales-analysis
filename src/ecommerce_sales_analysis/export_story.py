import json
from pathlib import Path

import pandas as pd

from ecommerce_sales_analysis import queries as q
from ecommerce_sales_analysis.db.engine import engine
from ecommerce_sales_analysis.setup_db import ensure_db

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "site" / "data"

# One JSON file per dataset the story page needs: file name -> SQL query.
EXPORTS = {
    "monthly_kpis": q.MONTHLY_KPIS_QUERY,
    "yearly_kpis": q.YEARLY_KPIS_QUERY,
    "monthly_drivers": q.MONTHLY_DRIVERS_QUERY,
    "return_rate_by_category_region": q.RETURN_RATE_BY_CAT_REGION_QUERY,
    "return_rate_by_category": q.RETURN_RATE_BY_CAT_TOTAL_QUERY,
    "return_rate_by_category_monthly": q.RETURN_RATE_BY_CAT_QUERY,
    "avg_delivery_by_region": q.AVG_DELIVERY_BY_REGION_QUERY,
    "csat_by_delivery_days": q.CSAT_DELIVERY_AGG_QUERY,
}


def write_json(name: str, df: pd.DataFrame) -> Path:
    path = OUTPUT_DIR / f"{name}.json"
    # Missing values (e.g. MoM for the first month) become null in JSON.
    records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
    path.write_text(json.dumps(records, indent=2) + "\n")
    return path


def export_delivery_csat_correlation() -> Path:
    """Pearson correlation between delivery days and rating, over all orders."""
    df = pd.read_sql(q.DELIVERY_CSAT_RAW_QUERY, engine)
    r = df["delivery_days"].corr(df["customer_rating"])
    path = OUTPUT_DIR / "csat_delivery_correlation.json"
    path.write_text(json.dumps({"r": round(float(r), 4), "order_count": len(df)}, indent=2) + "\n")
    return path


def main():
    ensure_db()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, query in EXPORTS.items():
        df = pd.read_sql(query, engine)
        path = write_json(name, df)
        print(f"Wrote {len(df)} rows to {path}")

    print(f"Wrote {export_delivery_csat_correlation()}")


if __name__ == "__main__":
    main()
