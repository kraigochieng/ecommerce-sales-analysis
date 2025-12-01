import datetime

import plotly.graph_objects as go
import streamlit as st

from ecommerce_sales_analysis import charts, data_loader, utils

st.set_page_config(layout="wide")
st.markdown(
    """
    <style>
        .block-container {padding-top: 1rem; padding-bottom: 0rem;}
        h1 {margin-bottom: 0rem;}
    </style>
    """,
    unsafe_allow_html=True
)
st.markdown(
    "<h1 style='text-align: center;'>Jumbo 360°: Global Operations Dashboard</h1>",
    unsafe_allow_html=True,
)

kpis = data_loader.fetch_kpi_data()
spark_data = data_loader.fetch_sparkline_lists()
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
        f"${utils.format_large_number(kpis['net_revenue'])} M",
        f"{mom_rev}% MoM",
        chart_data=spark_data["revenue"],
        chart_type="line",
        delta_color="off" if mom_rev == 0 else "normal",
        border=True,
    )

    # st.area_chart(spark_data['revenue'], height=40)

with kpi2:
    st.metric(
        "Average Order Value",
        f"${kpis['aov']:.2f}",
        f"{mom_aov}% MoM",
        chart_data=spark_data["aov"],
        chart_type="line",
        delta_color="off" if mom_aov == 0 else "normal",
        border=True,
    )

with kpi3:
    st.metric(
        "Return Rate",
        f"{kpis['return_rate']}%",
        f"{mom_ret}% MoM",
        chart_data=spark_data["return_rate"],
        chart_type="line",
        delta_color="off" if mom_ret == 0 else "inverse",
        border=True,
    )

with kpi4:
    st.metric(
        "Avg Delivery Days",
        f"{int(kpis['avg_delivery_days'])} days",
        f"{mom_del}% MoM",
        chart_data=spark_data["delivery"],
        chart_type="line",
        delta_color="off" if mom_del == 0 else "inverse",
        border=True,
    )

with kpi5:
    st.metric(
        "CSAT",
        f"{kpis['csat']} / 5 stars",
        f"{mom_csat}% MoM",
        chart_data=spark_data["csat"],
        chart_type="line",
        delta_color="off" if mom_csat == 0 else "normal",
        border=True,
    )


overview_column, in_depth_column = st.columns(2)

breakdown_data = data_loader.fetch_metric_breakdowns()
df_region = breakdown_data["by_region"]
df_cat = breakdown_data["by_category"]

with overview_column:
    tab_rev, tab_aov, tab_ret, tab_del, tab_csat = st.tabs(
        ["Revenue", "AOV", "Returns", "Delivery", "CSAT"]
    )

    with tab_rev:
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_region,
                    "dimension_value",
                    "net_revenue",
                    "Net Revenue by Region",
                    "Greens",
                ),
                use_container_width=True,
            )
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_cat,
                    "dimension_value",
                    "net_revenue",
                    "Net Revenue by Category",
                    "Greens",
                ),
                use_container_width=True,
            )

    # ------------------------------------------------------------------
    # TAB 2: AOV (Blue Theme)
    # ------------------------------------------------------------------
    with tab_aov:
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_region, "dimension_value", "aov", "AOV by Region", "Blues"
                ),
                use_container_width=True,
            )
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_cat, "dimension_value", "aov", "AOV by Category", "Blues"
                ),
                use_container_width=True,
            )

    # ------------------------------------------------------------------
    # TAB 3: RETURNS (Red Theme)
    # ------------------------------------------------------------------
    with tab_ret:
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_region,
                    "dimension_value",
                    "return_rate",
                    "Return Rate % by Region",
                    "Reds",
                ),
                use_container_width=True,
            )
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_cat,
                    "dimension_value",
                    "return_rate",
                    "Return Rate % by Category",
                    "Reds",
                ),
                use_container_width=True,
            )

    # ------------------------------------------------------------------
    # TAB 4: DELIVERY (Orange Theme)
    # ------------------------------------------------------------------
    with tab_del:
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_region,
                    "dimension_value",
                    "avg_delivery_days",
                    "Avg Delivery Days by Region",
                    "Oranges",
                ),
                use_container_width=True,
            )
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_cat,
                    "dimension_value",
                    "avg_delivery_days",
                    "Avg Delivery Days by Category",
                    "Oranges",
                ),
                use_container_width=True,
            )

    # ------------------------------------------------------------------
    # TAB 5: CSAT (Purple Theme)
    # ------------------------------------------------------------------
    with tab_csat:
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_region, "dimension_value", "csat", "CSAT by Region", "Purples"
                ),
                use_container_width=True,
            )
        with st.container(border=True):
            st.plotly_chart(
                charts.plot_breakdown_bar(
                    df_cat, "dimension_value", "csat", "CSAT by Category", "Purples"
                ),
                use_container_width=True,
            )


with in_depth_column:
    with st.container(border=True):
        fig_growth = charts.plot_growth_chart(df_growth)
        st.plotly_chart(fig_growth, width="stretch")

    with st.container(border=True):
        # 1. Fetch Aggregated Data
        df_csat_agg = data_loader.fetch_csat_delivery_trend()

        # 2. Plot Line Chart
        fig_csat = charts.plot_csat_delivery_trend(df_csat_agg)

        # 3. Render
        st.plotly_chart(fig_csat, width="stretch")
