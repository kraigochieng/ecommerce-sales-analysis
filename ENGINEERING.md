# Engineering Notes

Technical decisions behind this project's setup — for contributors/maintainers, not the business-facing summary in [README.md](README.md).

---

### Database: Postgres → SQLite

Originally used a hosted Postgres instance (Sevalla). Migrated to SQLite so the project is self-contained and deployable without a managed database.

-   [config.py](src/ecommerce_sales_analysis/config.py) builds `DATABASE_URL` as `sqlite:///{DB_NAME}`; `DB_NAME` defaults to `ecommerce_analysis.db` so no `.env`/secrets are required to run.
-   Old Postgres-specific code/SQL (connection settings, `::type` casts, `EXTRACT`/`TO_CHAR`, schema-qualified `public.` names) is commented out in place rather than deleted, with the SQLite equivalent directly below it — search for `postgres` across `sql/*.sql` and `src/` to see every swap.
-   `sql/etl.sql` needed one genuine SQLite-specific fix: `INSERT INTO t SELECT ... FROM x ON CONFLICT ...` (no `WHERE` in between) is a real SQLite grammar ambiguity — the parser can't tell `ON` apart from a join condition and throws `near "DO": syntax error`. Fixed by inserting a harmless `WHERE TRUE` before each upsert clause.

### Two schema paths — only one is live

-   **`orders` → `orders_cleaned` → `monthly_kpis_with_mom`** (raw SQL: `ddl.sql` → `cleaning.sql` → `eda.sql`) — this is what [data_loader.py](src/ecommerce_sales_analysis/data_loader.py) / [queries.py](src/ecommerce_sales_analysis/queries.py) actually query. This is the live path.
-   **Star schema** (`dim_region`, `dim_product`, `dim_customer`, `dim_date`, `fact_order` — defined in [db/models.py](src/ecommerce_sales_analysis/db/models.py), populated by `etl.sql`) — built and kept in sync, but `app.py` doesn't query it yet. `queries.py` has `get_dynamic_kpi_query()` / `fetch_kpi_data_star_schema()` ready to go if/when the UI switches over.

### Setup is now one command: `uv run setup-db`

[setup_db.py](src/ecommerce_sales_analysis/setup_db.py) creates all tables from the models (non-destructive — `engine.py`'s `create_tables()`, not the drop-and-recreate `test_connection()`), loads `data/synthetic_ecommerce_sales_2025.csv` into `orders`, then runs `cleaning.sql` → `eda.sql` → `etl.sql` in order. Every step is idempotent, so it's safe to re-run — the CSV load is skipped if `orders` already has rows, and the SQL scripts drop-and-rebuild their own derived tables.

Previously each `.sql` file had to be run by hand against the db (`sqlite3 db < sql/whatever.sql`); nothing in the codebase invoked them.

### Deployment: build-on-cold-start, not a committed binary

For Streamlit Cloud, the alternative to shipping a prebuilt `.db` file (which would mean committing a large binary that grows the repo on every rebuild) is having the app build its own database from the CSV that's already tracked in git.

`app.py` calls `ensure_db()` on startup, wrapped in `@st.cache_resource` so it runs once per container:

-   Fresh container → tables don't exist → full `setup-db` pipeline runs (a few seconds) → cached for the container's lifetime.
-   Any rerun after that → tables already exist → no-op.

`*.db` files are gitignored; the only thing that needs to be committed is the source CSV (already tracked) and the SQL/Python that builds the db from it.
