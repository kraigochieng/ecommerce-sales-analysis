# Raw SQL queries used by export_story.py to build the story page data.

RETURN_RATE_BY_CAT_QUERY = """
    SELECT
        order_date_year_month,
        product_category,
        -- ROUND((SUM(is_returned)::numeric / COUNT(*)) * 100, 2) AS return_rate
        ROUND((CAST(SUM(is_returned) AS REAL) / COUNT(*)) * 100, 2) AS return_rate
    FROM orders_cleaned
    GROUP BY order_date_year_month, product_category
    ORDER BY order_date_year_month ASC;
"""

RETURN_RATE_BY_CAT_TOTAL_QUERY = """
    SELECT
        product_category,
        ROUND((CAST(SUM(is_returned) AS REAL) / COUNT(*)) * 100, 2) AS return_rate,
        COUNT(*) AS order_count
    FROM orders_cleaned
    GROUP BY product_category
    ORDER BY return_rate DESC;
"""

MONTHLY_KPIS_QUERY = """
    SELECT *
    FROM monthly_kpis_with_mom
    ORDER BY order_date_year_month ASC;
"""

YEARLY_KPIS_QUERY = """
    SELECT
        SUBSTR(order_date_year_month, 1, 4) AS year,
        SUM(revenue) AS net_revenue,
        COUNT(*) AS order_count,
        ROUND(AVG(revenue), 2) AS aov,
        ROUND((CAST(SUM(is_returned) AS REAL) / COUNT(*)) * 100, 2) AS return_rate,
        ROUND(AVG(delivery_days), 2) AS avg_delivery_days,
        ROUND(AVG(customer_rating), 2) AS csat
    FROM orders_cleaned
    GROUP BY year
    ORDER BY year ASC;
"""

MONTHLY_DRIVERS_QUERY = """
    SELECT
        order_date_year_month,
        COUNT(*) AS order_count,
        ROUND(AVG(quantity), 2) AS avg_quantity,
        ROUND(AVG(discount_percent), 2) AS avg_discount_percent
    FROM orders_cleaned
    GROUP BY order_date_year_month
    ORDER BY order_date_year_month ASC;
"""

RETURN_RATE_BY_CAT_REGION_QUERY = """
    SELECT
        region,
        product_category,
        ROUND((CAST(SUM(is_returned) AS REAL) / COUNT(*)) * 100, 2) AS return_rate,
        COUNT(*) AS order_count
    FROM orders_cleaned
    GROUP BY region, product_category
    ORDER BY region ASC, return_rate DESC;
"""

DELIVERY_CSAT_RAW_QUERY = """
    SELECT delivery_days, customer_rating
    FROM orders_cleaned;
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
        ROUND(AVG(delivery_days), 2) as avg_delivery_days
    FROM orders_cleaned
    GROUP BY region
    ORDER BY avg_delivery_days DESC;
"""
