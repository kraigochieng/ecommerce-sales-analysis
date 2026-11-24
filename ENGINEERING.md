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

---

### The ask panel: a model answers questions from the browser

The panel lives in [site/ask/](site/ask/). It has no server. The reader brings an OpenRouter key (a paste field, kept in memory only). Issue #19 holds the plan and the decision records.

**Flow.** Each step is one unit.

1.  `prompts.js` builds the messages. The schema, the rules, and the catalog description come from one place each.
2.  `ask_flow.js` asks the model for one SQL query, runs it, asks the model to design the answer, and validates the design. When the model can fix a problem, the flow asks once more with the problem text.
3.  `query_guard.js` accepts one `SELECT` or `WITH` statement. `query_engine.js` then loads `orders.csv` into DuckDB-WASM, sets `enable_external_access = false` and `lock_configuration = true`, and runs the query inside a limit of 200 rows.
4.  `a2ui_validator.js` checks the design against `a2ui_catalog.js`. `a2ui_renderer.js` draws it with `charts.js`. Every text goes in with `textContent`.

**A2UI.** The messages follow the shape of A2UI v0.9.1: `updateComponents` with a flat list of components and child IDs, and bindings such as `{"path": "/rows"}`. The catalog is our own (`jumbo-ask-catalog-v1`: Column, Text, Stat, BarChart, LineChart, Table). The page owns `createSurface` and `updateDataModel`, so the validator refuses them from the model. The page does not use A2UI actions or streaming. I read the v0.9.1 specification, not a reference renderer, and I did not test the messages against another A2UI client.

**Why vendored files and an import map.** The DuckDB-WASM bundle imports `apache-arrow` as a bare module name. A browser cannot resolve that name without an import map. `npm run vendor` copies the files to `site/vendor/` (gitignored, built in CI). The import map is inline, and the Content-Security-Policy allows it by hash. A test checks that the hash matches. If you change the import map, update the hash in `site/index.html`.

**Security limits.**

-   The key is in a closure, not in storage, not in the URL, and not in any message. Any script on the page can still read the field. The policy allows only own scripts, so keep third-party scripts out of `index.html`.
-   The policy limits `connect-src` to the page and `https://openrouter.ai`. OpenRouter answers with `access-control-allow-origin: *`, so any site can call it with a key.
-   The guard works on text. The database lock and the in-memory copy of public data are the second line of defense.
-   The question and the rows go to the model. Treat the model as untrusted: its output passes the validator before it reaches the DOM.

**Tests.** `npm test` runs `node --test` on `tests/`. The live test in `tests/site/ask/live_openrouter.test.js` runs only when `OPENROUTER_API_KEY` is set (for example in `.env`). The renderer and the panel have no automated test, because the repo has no DOM test tool. I checked them by hand in a real browser.

**The `.env` file.** `Settings` ignores keys that it does not declare, so `.env` can hold `OPENROUTER_API_KEY` for the live test.
