# Jumbo Global Operations: a data story

<a href="https://kraigochieng.github.io/ecommerce-sales-analysis/">
    <img src="docs/story-screenshot.png" alt="Screenshot of the Jumbo data story page" width="800">
</a>

**[Read the story](https://kraigochieng.github.io/ecommerce-sales-analysis/)**: every chart carries its own insight and recommendation.

---

### Project Background

Jumbo is a sample global e-commerce company. Its sales data is underused after transaction processing. This project analyses 100,000 orders (2023–2025) for the Head of Global Operations, and turns them into actions.

Four findings, each with a chart and recommendations on the page:

1. **November:** one extra unit per order lifts revenue by about 20% every year. Orders and discounts stay flat.
2. **Fashion returns:** 12.2% of Fashion orders come back, 2.4 times the rate of other categories. The gap holds in every region.
3. **Delivery:** 5 days in every region. No region lags.
4. **Customer rating:** flat at 3.5 out of 5, whatever the delivery time. Faster shipping does not buy happier customers.

The page also lists the data caveats, such as one item per order and no cost data.

---

### Data Structure Overview

Rows: 100,000

<figure>
    <img src="docs/ecommerce-erd.png" alt="ERD" width="240">
    <figcaption>ERD diagram of data</figcaption>
</figure>

SQL for [DDL](/sql/ddl.sql), [data cleaning and augmentation](/sql/cleaning.sql), [EDA](/sql/eda.sql) and [ETL](/sql/etl.sql).

---

### Run it locally

```sh
uv run setup-db       # build the SQLite database from the CSV
uv run export-story   # write the chart data to site/data/*.json and site/data/orders.csv
npm ci                # install the locked packages (Node 22.9 or later)
npm run vendor        # copy DuckDB-WASM into site/vendor/
python3 -m http.server 8000 --directory site
```

Then open <http://localhost:8000>. Run `npm test` for the site tests. Pushes to `main` rebuild and publish the page with GitHub Actions.

---

### Ask the data

The page ends with an optional panel. The reader pastes an OpenRouter key and asks a question in plain words. A model (Anthropic Claude Haiku 5.5) writes one SQL query. The browser runs the query on the order data with DuckDB-WASM. The model then designs the answer as [A2UI](https://a2ui.org) messages, and the page draws them with its own charts. The panel shows the query under each answer.

-   The key stays in the memory of the tab. The page does not save it, and sends it only to `openrouter.ai`.
-   Use a key with a low credit limit. The model can write a wrong query, so check the query.
-   There is no server. The first question downloads `orders.csv` (about 2 MB compressed).

For the design, see [ENGINEERING.md](/ENGINEERING.md).

_For database setup and technical decisions, see [ENGINEERING.md](/ENGINEERING.md)._
