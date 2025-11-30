import streamlit as st

from ecommerce_sales_analysis import charts, data_loader, utils

st.set_page_config(layout="wide")  # Optional: makes use of full screen width
st.title("Cloud Database Dashboard")

# --- 1. LOAD DATA ---
kpis = data_loader.fetch_kpi_data()
return_data = data_loader.fetch_return_trends()
df_growth = data_loader.fetch_growth_data()

# --- 2. KPI SECTION ---
# Extract values for readability
mom_rev = kpis["mom_revenue_pct"]
mom_aov = kpis["mom_aov_pct"]
mom_ret = kpis["mom_return_rate_pct"]
mom_del = kpis["mom_delivery_pct"]
mom_csat = kpis["mom_csat_pct"]

kpi1, kpi2, kpi3, kpi4, kpi5 = st.columns(5)

with kpi1:
    st.metric(
        "Net Revenue",
        f"${utils.format_large_number(kpis['net_revenue'])}M",
        f"{mom_rev}%",
        delta_color="off" if mom_rev == 0 else "normal",
    )

with kpi2:
    st.metric(
        "Avg Order Value",
        f"${kpis['aov']:.2f}",
        f"{mom_aov}%",
        delta_color="off" if mom_aov == 0 else "normal",
    )

with kpi3:
    st.metric(
        "Return Rate",
        f"{kpis['return_rate']}%",
        f"{mom_ret}%",
        delta_color="off" if mom_ret == 0 else "inverse",
    )

with kpi4:
    st.metric(
        "Avg Delivery Days",
        f"{int(kpis['avg_delivery_days'])} days",
        f"{mom_del}%",
        delta_color="off" if mom_del == 0 else "inverse",
    )

with kpi5:
    st.metric(
        "Customer Rating",
        f"{kpis['csat']}/5.0",
        f"{mom_csat}%",
        delta_color="off" if mom_csat == 0 else "normal",
    )

st.markdown("---")

# --- 3. RETURN RATE ANALYSIS ---
st.subheader("📦 Return Rate Analysis")

tab1, tab2, tab3 = st.tabs(["Overall Trend", "By Region", "By Category"])

with tab1:
    fig = charts.plot_line_chart(
        return_data["overall"],
        "order_date_year_month",
        "return_rate",
        "Global Return Rate Trend",
    )
    fig.update_traces(line_color="red")
    st.plotly_chart(fig, width="stretch")

with tab2:
    fig = charts.plot_line_chart(
        return_data["region"],
        "order_date_year_month",
        "return_rate",
        "Return Rate by Region",
        color_col="region",
    )
    st.plotly_chart(fig, width="stretch")

with tab3:
    fig = charts.plot_line_chart(
        return_data["category"],
        "order_date_year_month",
        "return_rate",
        "Return Rate by Category",
        color_col="product_category",
    )
    st.plotly_chart(fig, width="stretch")

# --- 4. GROWTH ANALYSIS ---
st.markdown("---")
st.subheader("📈 Revenue Quality & Satisfaction")

col1, col2 = st.columns(2)

with col1:
    st.caption("Does selling more expensive items drive growth?")
    fig_growth = charts.plot_growth_chart(df_growth)
    st.plotly_chart(fig_growth, width="stretch")


with col2:
    st.caption("Does slower delivery hurt our ratings?")

    # 1. Fetch Aggregated Data
    df_csat_agg = data_loader.fetch_csat_delivery_trend()

    # 2. Plot Line Chart
    fig_csat = charts.plot_csat_delivery_trend(df_csat_agg)

    # 3. Render
    st.plotly_chart(fig_csat, width="stretch")

    st.caption("No it does not")


# --- 5. REGIONAL DELIVERY ANALYSIS ---
# You can place this under the 'Return Rate' section or in a new row
st.markdown("---")
st.subheader("🚚 Regional Logistics Performance")

# 1. Fetch
df_delivery_region = data_loader.fetch_avg_delivery_by_region()

# 2. Plot
fig_delivery_region = charts.plot_avg_delivery_by_region(df_delivery_region)

# 3. Render
st.plotly_chart(fig_delivery_region, width="stretch")
