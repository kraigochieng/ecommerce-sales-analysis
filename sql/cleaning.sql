DROP TABLE IF EXISTS orders_cleaned CASCADE;
create table orders_cleaned as
select
	*,
	extract(year from order_date) as order_date_year,
	extract(month from order_date) as order_date_month,
	TO_CHAR(order_date, 'YYYY-MM') as order_date_year_month
from
	orders;



