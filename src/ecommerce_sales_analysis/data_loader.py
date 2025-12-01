from datetime import timedelta

import pandas as pd
import streamlit as st
from sqlalchemy import text

import ecommerce_sales_analysis.queries as q
from ecommerce_sales_analysis import queries as q
from ecommerce_sales_analysis.db.engine import Session, engine


@st.cache_data(ttl=600)
def fetch_kpi_data():
    """Returns the single latest row of KPIs as a Series."""
    df = pd.read_sql(q.KPI_LATEST_QUERY, engine)
    return df.iloc[0]


def fetch_kpi_data_dynamic(start_date, end_date, regions, categories):
    """
    Fetches KPIs for the selected range AND the previous period
    to calculate on-the-fly MoM changes.
    """

    # --- 1. HELPER: Run the query for a specific window ---
    def get_metrics(s_date, e_date):
        # Prepare parameters for SQLAlchemy
        params = {
            "start_date": s_date,
            "end_date": e_date,
            "regions": tuple(regions) if regions else ("Empty",),
            "filter_regions": len(regions)
            > 0,  # True if user selected specific regions
            "categories": tuple(categories) if categories else ("Empty",),
            "filter_categories": len(categories) > 0,
        }

        with engine.connect() as conn:
            result = conn.execute(q.DYNAMIC_KPI_SQL, params)
            # .mappings().one() returns the row as a dictionary
            return result.mappings().one()

    # --- 2. GET CURRENT METRICS ---
    current = get_metrics(start_date, end_date)

    # --- 3. CALCULATE PREVIOUS DATES ---
    # We compare "Same Duration": If user picks 7 days, we look back 7 days.
    duration = end_date - start_date
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - duration

    # --- 4. GET PREVIOUS METRICS ---
    previous = get_metrics(prev_start, prev_end)

    # --- 5. COMBINE & CALCULATE DELTAS ---
    def calc_delta(curr, prev):
        """Safe percentage change calculation"""
        if prev is None or prev == 0:
            return 0.0
        if curr is None:
            curr = 0.0
        return round(((float(curr) - float(prev)) / float(prev)) * 100, 1)

    # Return a dictionary compatible with your app.py structure
    return {
        # Current Values (Use 'or 0' to handle None values if no data found)
        "net_revenue": current["net_revenue"] or 0,
        "aov": current["aov"] or 0,
        "return_rate": round(current["return_rate"] or 0, 2),
        "avg_delivery_days": round(current["avg_delivery_days"] or 0, 1),
        "csat": round(current["csat"] or 0, 1),
        # Calculated Deltas (Renamed to match your app.py variables)
        "mom_revenue_pct": calc_delta(current["net_revenue"], previous["net_revenue"]),
        "mom_aov_pct": calc_delta(current["aov"], previous["aov"]),
        "mom_return_rate_pct": calc_delta(
            current["return_rate"], previous["return_rate"]
        ),
        "mom_delivery_pct": calc_delta(
            current["avg_delivery_days"], previous["avg_delivery_days"]
        ),
        "mom_csat_pct": calc_delta(current["csat"], previous["csat"]),
    }


@st.cache_data(ttl=600)
def fetch_return_trends():
    """Returns a dictionary containing the three return rate dataframes."""
    return {
        "category": pd.read_sql(q.RETURN_RATE_BY_CAT_QUERY, engine),
        "region": pd.read_sql(q.RETURN_RATE_BY_REGION_QUERY, engine),
        "overall": pd.read_sql(q.RETURN_RATE_OVERALL_QUERY, engine),
    }


@st.cache_data(ttl=600)
def fetch_growth_data():
    """Fetches and transforms (melts) the Revenue vs AOV data."""
    df = pd.read_sql(q.GROWTH_MOM_QUERY, engine)

    # Perform the transformation HERE, not in the app
    df_melted = df.melt(
        id_vars=["order_date_year_month"],
        value_vars=["mom_revenue_pct", "mom_aov_pct"],
        var_name="Metric",
        value_name="Growth Rate",
    )

    df_melted["Metric"] = df_melted["Metric"].replace(
        {"mom_revenue_pct": "Net Revenue Growth", "mom_aov_pct": "AOV Growth"}
    )
    return df_melted


@st.cache_data(ttl=600)
def fetch_csat_delivery_trend():
    """Fetches average rating for each discrete delivery day count."""
    df = pd.read_sql(q.CSAT_DELIVERY_AGG_QUERY, engine)
    # Optional filter: Remove outliers (e.g., delivery took 50 days but only happened once)
    # df = df[df['order_count'] > 10]
    return df


@st.cache_data(ttl=600)
def fetch_avg_delivery_by_region():
    """Fetches average delivery time for each region."""
    return pd.read_sql(q.AVG_DELIVERY_BY_REGION_QUERY, engine)


@st.cache_data(ttl=600)
def fetch_sparkline_lists():
    """
    Fetches the last 12 months of data and converts columns into simple lists
    for the native Streamlit sparkline feature.
    """
    df = pd.read_sql(q.SPARKLINES_QUERY, engine)

    # Convert dataframe columns to standard Python lists
    return {
        "revenue": df["net_revenue"].tolist(),
        "aov": df["aov"].tolist(),
        "return_rate": df["return_rate"].tolist(),
        "delivery": df["avg_delivery_days"].tolist(),
        "csat": df["csat"].tolist(),
    }


def fetch_kpi_data_star_schema(start_date, end_date, regions, categories):
    with Session() as session:
        # --- 1. HELPER: Execute Query for a Window ---
        def get_metrics(s_date, e_date):
            # Build the query object
            query = q.get_dynamic_kpi_query(
                session, s_date, e_date, regions, categories
            )

            # Execute and fetch the single result row
            result = query.one()

            # Convert SQLAlchemy result to a simple dictionary
            return {
                "net_revenue": result.net_revenue or 0,
                "aov": result.aov or 0,
                "return_rate": float(result.return_rate or 0),
                "avg_delivery_days": float(result.avg_delivery_days or 0),
                "csat": float(result.csat or 0),
            }

        # --- 2. GET CURRENT & PREVIOUS METRICS ---
        current = get_metrics(start_date, end_date)

        # Calculate previous date range
        duration = end_date - start_date
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - duration

        previous = get_metrics(prev_start, prev_end)

        # --- 3. CALCULATE DELTAS ---
        def calc_delta(curr, prev):
            if not prev or prev == 0:
                return 0.0
            return round(((float(curr) - float(prev)) / float(prev)) * 100, 1)

        # Return combined dictionary (same structure as before so App.py doesn't break)
        return {
            # Values
            "net_revenue": current["net_revenue"],
            "aov": current["aov"],
            "return_rate": round(current["return_rate"], 2),
            "avg_delivery_days": round(current["avg_delivery_days"], 1),
            "csat": round(current["csat"], 1),
            # Deltas
            "mom_revenue_pct": calc_delta(
                current["net_revenue"], previous["net_revenue"]
            ),
            "mom_aov_pct": calc_delta(current["aov"], previous["aov"]),
            "mom_return_rate_pct": calc_delta(
                current["return_rate"], previous["return_rate"]
            ),
            "mom_delivery_pct": calc_delta(
                current["avg_delivery_days"], previous["avg_delivery_days"]
            ),
            "mom_csat_pct": calc_delta(current["csat"], previous["csat"]),
        }


@st.cache_data(ttl=600)
def fetch_metric_breakdowns():
    """
    Fetches KPI breakdowns by Region and by Category for ALL data.
    """

    def get_data(dimension_column):
        # 1. Get the raw SQL string from the TextClause object
        # accessing .text directly gets the string content you defined
        raw_sql = q.DIMENSION_BREAKDOWN_SQL.text

        # 2. Perform the string replacement for the column name
        # (This is safe because dimension_column is hardcoded in our code, not user input)
        final_query_str = raw_sql.replace("{dimension_col}", dimension_column)

        # 3. Execute
        with engine.connect() as conn:
            # Wrap the final string back into text() for execution
            return pd.read_sql(text(final_query_str), conn)

    return {
        "by_region": get_data("region"),
        "by_category": get_data("product_category"),
    }
