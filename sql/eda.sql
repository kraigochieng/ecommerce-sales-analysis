-- 1. Drop it if it exists so we can recreate it cleanly
DROP TABLE IF EXISTS monthly_kpis_with_mom;
-- 2. Create the View
CREATE TABLE monthly_kpis_with_mom AS

WITH monthly_aggregated AS (
-- Step 1: Calculate the Raw Values per Month
SELECT
	order_date_year_month,
	SUM(revenue) AS net_revenue,
	ROUND(AVG(revenue), 2) AS aov,
	ROUND(AVG(delivery_days), 1) AS avg_delivery_days,
	ROUND(SUM(is_returned)::DECIMAL / COUNT(is_returned) * 100, 2) AS return_rate,
	ROUND(AVG(customer_rating), 1) AS csat
FROM
	orders_cleaned
GROUP BY
	order_date_year_month
),
kpis_with_history AS (
-- Step 2: Look back at the previous month for ALL metrics
SELECT
	order_date_year_month,
	-- Current Values
	net_revenue,
	aov,
	avg_delivery_days,
	return_rate,
	csat,
	-- Previous Month Values (LAG)
	LAG(net_revenue) OVER(ORDER BY order_date_year_month) AS prev_revenue,
	LAG(aov) OVER(ORDER BY order_date_year_month) AS prev_aov,
	LAG(avg_delivery_days) OVER(ORDER BY order_date_year_month) AS prev_delivery,
	LAG(return_rate) OVER(ORDER BY order_date_year_month) AS prev_return_rate,
	LAG(csat) OVER(ORDER BY order_date_year_month) AS prev_csat
FROM
	monthly_aggregated
)
-- Step 3: Calculate the % Change
SELECT
	order_date_year_month,

	net_revenue,
	ROUND(((net_revenue - prev_revenue) / NULLIF(prev_revenue, 0)) * 100, 2) AS mom_revenue_pct,

	aov,
	ROUND(((aov - prev_aov) / NULLIF(prev_aov, 0)) * 100, 2) AS mom_aov_pct,

	avg_delivery_days,
	ROUND(((avg_delivery_days - prev_delivery) / NULLIF(prev_delivery, 0)) * 100, 2) AS mom_delivery_pct,

	return_rate,
	ROUND(((return_rate - prev_return_rate) / NULLIF(prev_return_rate, 0)) * 100, 2) AS mom_return_rate_pct,
	
	csat,
	ROUND(((csat - prev_csat) / NULLIF(prev_csat, 0)) * 100, 2) AS mom_csat_pct
FROM
	kpis_with_history
ORDER BY
	order_date_year_month DESC;
