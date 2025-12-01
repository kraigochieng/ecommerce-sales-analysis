INSERT
	INTO
	dim_region (region_name)
SELECT
	DISTINCT region
FROM
	orders_cleaned
	-- The 'ON CONFLICT' clause prevents errors if you run this script twice
ON
	CONFLICT (region_name) DO NOTHING;

INSERT
	INTO
	dim_product (product_category)
SELECT
	DISTINCT product_category
FROM
	orders_cleaned
ON
	CONFLICT (product_category) DO NOTHING;

INSERT
	INTO
	dim_customer (customer_id)
SELECT
	DISTINCT customer_id
FROM
	orders_cleaned
ON
	CONFLICT (customer_id) DO NOTHING;

INSERT
	INTO
	dim_date (date_id,
	order_date_year,
	order_date_month,
	order_date_year_month_str)
SELECT
	DISTINCT 
    order_date,
	EXTRACT(YEAR FROM order_date) AS order_date_year,
	EXTRACT(MONTH FROM order_date) AS order_date_month,
	TO_CHAR(order_date, 'YYYY-MM') AS order_date_year_month_str
FROM
	orders_cleaned
ON
	CONFLICT (date_id) DO NOTHING;

INSERT
	INTO
	fact_order (
    order_id,
	customer_key,
	region_key,
	product_key,
	date_key,
	product_price,
	quantity,
	discount_percent,
	revenue,
	customer_rating,
	delivery_days,
	is_returned
)
SELECT
	src.order_id,
	src.customer_id,
	dr.region_id,
	dp.product_id,
	src.order_date,
	-- the ORDER date IS the PRIMARY key
	src.product_price,
	src.quantity,
	src.discount_percent,
	src.revenue,
	src.customer_rating,
	src.delivery_days,
	src.is_returned
FROM
	orders_cleaned src
LEFT JOIN dim_region dr ON
	src.region = dr.region_name
LEFT JOIN dim_product dp ON
	src.product_category = dp.product_category
ON
	CONFLICT (order_id) DO NOTHING;

SELECT
	f.order_id,
	r.region_name,
	p.product_category,
	f.revenue
FROM
	fact_order f
JOIN 
    dim_region r ON
	f.region_key = r.region_id
JOIN 
    dim_product p ON
	f.product_key = p.product_id
LIMIT 5;