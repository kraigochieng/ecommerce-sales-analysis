import pandas as pd
import streamlit as st

import ecommerce_sales_analysis.queries as q
from ecommerce_sales_analysis.db import engine


@st.cache_data(ttl=600)
def fetch_kpi_data():
    """Returns the single latest row of KPIs as a Series."""
    df = pd.read_sql(q.KPI_LATEST_QUERY, engine)
    return df.iloc[0]


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
