CREATE TABLE IF NOT EXISTS public.orders (
    order_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    product_category VARCHAR(50),
    product_price NUMERIC(10, 2),
    quantity INTEGER,
    order_date DATE,
    region VARCHAR(50),
    payment_method VARCHAR(50),
    delivery_days INTEGER,
    is_returned INTEGER,
    customer_rating NUMERIC(2, 1),
    discount_percent INTEGER,
    revenue NUMERIC(10, 2)
);