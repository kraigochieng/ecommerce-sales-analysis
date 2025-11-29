# Raw SQL queries

KPI_LATEST_QUERY = "SELECT * FROM monthly_kpis_with_mom"

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
