# Engineering Notes

Technical decisions behind this project's setup — for contributors/maintainers, not the business-facing summary in [README.md](README.md).

---

### Database: Postgres → SQLite

Originally used a hosted Postgres instance (Sevalla). Migrated to SQLite so the project is self-contained and deployable without a managed database.

-   [config.py](src/ecommerce_sales_analysis/config.py) builds `DATABASE_URL` as `sqlite:///{DB_NAME}`; `DB_NAME` defaults to `ecommerce_analysis.db` so no `.env`/secrets are required to run.
-   Old Postgres-specific code/SQL (connection settings, `::type` casts, `EXTRACT`/`TO_CHAR`, schema-qualified `public.` names) is commented out in place rather than deleted, with the SQLite equivalent directly below it — search for `postgres` across `sql/*.sql` and `src/` to see every swap.
-   `sql/etl.sql` needed one genuine SQLite-specific fix: `INSERT INTO t SELECT ... FROM x ON CONFLICT ...` (no `WHERE` in between) is a real SQLite grammar ambiguity — the parser can't tell `ON` apart from a join condition and throws `near "DO": syntax error`. Fixed by inserting a harmless `WHERE TRUE` before each upsert clause.

### Two schema paths — only one is live

-   **`orders` → `orders_cleaned` → `monthly_kpis_with_mom`** (raw SQL: `ddl.sql` → `cleaning.sql` → `eda.sql`) — this is what [export_story.py](src/ecommerce_sales_analysis/export_story.py) / [queries.py](src/ecommerce_sales_analysis/queries.py) actually query. This is the live path.
-   **Star schema** (`dim_region`, `dim_product`, `dim_customer`, `dim_date`, `fact_order` — defined in [db/models.py](src/ecommerce_sales_analysis/db/models.py), populated by `etl.sql`) — built and kept in sync, but nothing queries it yet. The helper that queried it was removed with the Streamlit dashboard; it is in git history (tag `v0.1.0-streamlit`) if the page ever needs the star schema.

### Setup is now one command: `uv run setup-db`

[setup_db.py](src/ecommerce_sales_analysis/setup_db.py) creates all tables from the models (non-destructive — `engine.py`'s `create_tables()`, not the drop-and-recreate `test_connection()`), loads `data/synthetic_ecommerce_sales_2025.csv` into `orders`, then runs `cleaning.sql` → `eda.sql` → `etl.sql` in order. Every step is idempotent, so it's safe to re-run — the CSV load is skipped if `orders` already has rows, and the SQL scripts drop-and-rebuild their own derived tables.

Previously each `.sql` file had to be run by hand against the db (`sqlite3 db < sql/whatever.sql`); nothing in the codebase invoked them.

### Delivery: a static story page on GitHub Pages

The page in [site/](site/) is plain HTML, CSS and JavaScript with hand-written SVG charts (see [charts.js](site/charts.js)). It has no server and no build step for the front end.

-   `uv run export-story` ([export_story.py](src/ecommerce_sales_analysis/export_story.py)) runs `ensure_db()`, then writes the aggregates the page needs to `site/data/*.json`. Each JSON file comes from one query in `queries.py`.
-   `site/data/` is gitignored. The [Pages workflow](.github/workflows/pages.yml) runs `uv run setup-db` and `uv run export-story` on every push to `main`, then publishes `site/`.
-   Each finding shows its headline, insight and first recommendation, with the charts and evidence in a native `<details>` accordion. Charts cannot measure their width while closed, so opening a section calls `redrawAll()` in [charts.js](site/charts.js).
-   The KPI strip compares full years (2025 vs 2024), not months. December always drops after the November spike, so a month-over-month change would mislead.

### Why the Streamlit dashboard was retired

The first version was a Streamlit app on Streamlit Cloud. The insights lived apart from the charts, in README text and static screenshots, and the two could drift apart. Streamlit also limited layout and annotation control, and it needed a server that rebuilt the database on every cold start.

The data is fixed (100,000 orders), so the story page replaces it: each chart carries its own headline, annotations and recommendation. The last commit with the dashboard is tagged [`v0.1.0-streamlit`](https://github.com/kraigochieng/ecommerce-sales-analysis/tree/v0.1.0-streamlit). Check out that tag to run it.
