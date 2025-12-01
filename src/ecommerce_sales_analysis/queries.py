from sqlalchemy import case, func, text
from sqlalchemy.orm import Session

from ecommerce_sales_analysis.db.models import DimDate, DimProduct, DimRegion, FactOrder

# Raw SQL queries

KPI_LATEST_QUERY = "SELECT * FROM monthly_kpis_with_mom"


DYNAMIC_KPI_SQL = text("""
    SELECT 
        SUM(revenue) as net_revenue,
        AVG(revenue) as aov,
        -- Handle division by zero for return rate
        CASE 
            WHEN COUNT(*) = 0 THEN 0 
            ELSE (SUM(is_returned)::numeric / COUNT(*)) * 100 
        END as return_rate,
        AVG(delivery_days) as avg_delivery_days,
        AVG(customer_rating) as csat
    FROM orders_cleaned
    WHERE order_date BETWEEN :start_date AND :end_date
    -- Dynamic Filters: If the list is empty, the boolean check passes and we ignore the filter
    AND (:filter_regions IS FALSE OR region IN :regions)
    AND (:filter_categories IS FALSE OR product_category IN :categories)
    ;
""")


RETURN_RATE_BY_CAT_QUERY = """
    SELECT
        order_date_year_month,
        product_category,
        ROUND((SUM(is_returned)::numeric / COUNT(*)) * 100, 2) AS return_rate
    FROM orders_cleaned
    GROUP BY order_date_year_month, product_category
    ORDER BY order_date_year_month ASC;
"""

RETURN_RATE_BY_REGION_QUERY = """
    SELECT 
        order_date_year_month, 
        region, 
        ROUND((SUM(is_returned)::numeric / COUNT(*)) * 100, 2) AS return_rate
    FROM orders_cleaned
    GROUP BY order_date_year_month, region
    ORDER BY order_date_year_month ASC;
"""

RETURN_RATE_OVERALL_QUERY = """
    SELECT 
        order_date_year_month, 
        ROUND((SUM(is_returned)::numeric / COUNT(*)) * 100, 2) AS return_rate
    FROM orders_cleaned
    GROUP BY order_date_year_month
    ORDER BY order_date_year_month ASC;
"""

GROWTH_MOM_QUERY = """
    SELECT
        order_date_year_month,
        mom_revenue_pct,
        mom_aov_pct
    FROM monthly_kpis_with_mom
    WHERE mom_revenue_pct IS NOT NULL
    ORDER BY order_date_year_month ASC;
"""


CSAT_DELIVERY_AGG_QUERY = """
    SELECT 
        delivery_days, 
        ROUND(AVG(customer_rating), 2) as avg_rating,
        COUNT(*) as order_count -- Good to have: lets you ignore days with tiny samples
    FROM orders_cleaned
    GROUP BY delivery_days
    ORDER BY delivery_days ASC;
"""


AVG_DELIVERY_BY_REGION_QUERY = """
    SELECT 
        region, 
        ROUND(AVG(delivery_days), 1) as avg_delivery_days
    FROM orders_cleaned
    GROUP BY region
    ORDER BY avg_delivery_days DESC;
"""


SPARKLINES_QUERY = """
    SELECT 
        net_revenue, 
        aov, 
        return_rate, 
        avg_delivery_days,
        csat
    FROM monthly_kpis_with_mom
    ORDER BY order_date_year_month ASC -- Oldest to newest for the chart
    LIMIT 12;
"""


def get_dynamic_kpi_query(
    session: Session, start_date, end_date, regions=None, categories=None
):
    """
    Builds a SQLAlchemy query to fetch KPIs based on filters.
    """

    # 1. Start with the Base Query on the Fact Table
    query = session.query(
        func.sum(FactOrder.revenue).label("net_revenue"),
        func.avg(FactOrder.revenue).label("aov"),
        # Calculate Return Rate: (Sum of returned / Count of orders) * 100
        # We use 'case' to avoid division by zero
        (
            func.sum(FactOrder.is_returned)
            / func.nullif(func.count(FactOrder.order_id), 0)
            * 100
        ).label("return_rate"),
        func.avg(FactOrder.delivery_days).label("avg_delivery_days"),
        func.avg(FactOrder.customer_rating).label("csat"),
    )

    # 2. Join the necessary Dimension Tables
    # We join DimDate to filter by date range
    query = query.join(DimDate, FactOrder.date_key == DimDate.date_id)

    # We join DimRegion ONLY if we are filtering by region
    if regions:
        query = query.join(DimRegion, FactOrder.region_key == DimRegion.region_id)

    # We join DimProduct ONLY if we are filtering by category
    if categories:
        query = query.join(DimProduct, FactOrder.product_key == DimProduct.product_id)

    # 3. Apply Filters
    query = query.filter(DimDate.date_id.between(start_date, end_date))

    if regions:
        query = query.filter(DimRegion.region_name.in_(regions))

    if categories:
        query = query.filter(DimProduct.product_category.in_(categories))

    return query


DIMENSION_BREAKDOWN_SQL = text("""
    SELECT 
        {dimension_col} as dimension_value,
        SUM(revenue) as net_revenue,
        AVG(revenue) as aov,
        (SUM(is_returned)::numeric / COUNT(*)) * 100 as return_rate,
        AVG(delivery_days) as avg_delivery_days,
        AVG(customer_rating) as csat
    FROM orders_cleaned
    GROUP BY {dimension_col}
    ORDER BY net_revenue DESC;
""")
