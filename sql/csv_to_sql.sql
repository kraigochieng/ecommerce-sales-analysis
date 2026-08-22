-- COPY orders FROM '/home/kraigochieng/projects/ecommerce-analysis/data/synthetic_ecommerce_sales_2025.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Run this file through the sqlite3 CLI (dot-commands only work there, not via a
-- generic SQL driver): sqlite3 ecommerce_analysis.db < sql/csv_to_sql.sql
.mode csv
.import --skip 1 data/synthetic_ecommerce_sales_2025.csv orders