# E-commerce Dashboard

### Project Background

Jumbo is a sample global e-commerce company. The company has data on sales that is underutilised after transactional processing. This project analyses sales data for the Head of Global Operations in order to improve global operations.

Insights and recommendations are provided in the following areas:

-   **Sales Trend Analysis**: Average Order Value (AOV) and Net Revenue being looked at
-   **Average Delivery Time**: Seeing if a certain _region_ affects this and seeing where to optimise in that region
-   **Return Rate**: Seeing if a certain _product category_ and/or _region_ affects this and seeing where to optimise
-   **Correlations**: Correlation between Customer satisfaction and Delivery Time

SQL queries for [DDL](/sql/ddl.sql), [Data Cleaning and Augmentation](/sql/cleaning.sql) and [ETL](/sql/etl.sql)

Find the dashboard [here](https://ecommerce-sales-analysis.streamlit.app/)

### Data Structure Overview

Rows: 100,000

<figure>
    <img src="docs/ecommerce-erd.png" alt="ERD" width="240">
    <figcaption>ERD diagram of data</figcaption>
</figure>

### Executive Summary

| Insights                                                                                                                                                 | Recommendations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both _Net Revenue_ and _AOV_ spike by `~20%` in November then go down in December by `~-20%` before going back to normal MoM growth of `~10%` in January | <ul><li><strong>Marketing:</strong> Pivot December ads to <strong>Gift Cards</strong> and <strong>Express Shipping</strong> to capture late shoppers after the main rush.</li><li><strong>Merchandising:</strong> Use <strong>bundle-only deals</strong> in November to maximize the natural spike in order value (AOV).</li><li><strong>Retention:</strong> Launch a <strong>"New Year" email campaign</strong> to turn one-time November buyers into recurring January customers.</li><li><strong>Operations:</strong> Increase warehouse staffing in early January specifically to handle the <strong>post-holiday return wave</strong>.</li></ul> |
| _Return rate_ for fashion items `(~12%)` is almost double compared to other product categories `(~6%)`                                                   | <ul><li>Implement AI sizing tools or "True-to-Fit" reviews to reduce sizing errors.</li><li>Add high-resolution fabric close-ups to manage material expectations better.</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| _Average Delivery Time_ per region has the same `(5 days)`.                                                                                              | <ul><li><strong>Marketing</strong>: Promote your "Consistent Global Delivery" as a key value prop in remote markets.</li><li><strong>Operations</strong>: Investigate if local warehousing is necessary, or if a centralized hub is sufficient given the consistency.</li></ul>                                                                                                                                                                                                                                                                                                                                                                       |
| _Average Delivery Time_ and _CSAT_ have no correlation. CSAT remains to be `3.5/5` the same across                                                       | <ul><li><strong>Cost Savings</strong>: Switch to economy shipping tiers to improve margins, as speed does not impact satisfaction.</li><li><strong>Strategy</strong>: Stop optimizing for speed and reallocate that budget to Quality Control to lower the Fashion return rate.</li></ul>                                                                                                                                                                                                                                                                                                                                                             |

### Caveats and Assumptions

-   _Single-Item Orders_: Each order consists of only one distinct product type, limiting basket analysis or cross-selling insights.
-   _No Recurring Customers_: Each Customer ID appears only once, making Customer Lifetime Value (CLV) or retention analysis impossible.
-   _Revenue Focus_: Cost of Goods Sold (COGS) and shipping costs are missing, so analysis focuses on Top-line Revenue, not Net Profit.
-   _Broad Categorization_: Products are grouped into high-level categories (e.g., "Fashion"), masking performance differences of specific SKUs.
-   _Binary Returns_: Returns are flagged simply as "Yes/No" without specific return reasons or timestamps.
-   _Single Currency_: All financial values are assumed to be in a single currency (e.g., USD) with no exchange rate fluctuations.
-   _Delivery Calculation_: Delivery days are treated as calendar days from the moment of order placement to final delivery.
