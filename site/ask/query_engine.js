// Runs read-only SQL on the order data. The database is DuckDB-WASM in the browser.
// The order data loads on the first query, because the file is about 2 MB compressed.

import { MAXIMUM_RESULT_ROWS, ORDERS_TABLE } from "./config.js";
import { DataLoadError, QueryFailedError } from "./errors.js";
import { assertReadOnlyQuery } from "./query_guard.js";

const CSV_NAME = "orders.csv";

/**
 * @typedef {Record<string, string | number | boolean | null>} ResultRow
 * @typedef {{ columns: string[], rows: ResultRow[] }} ResultTable
 * @typedef {object} DatabaseSession  One open database. Side effect: runs SQL.
 * @property {(options: { name: string, bytes: Uint8Array }) => Promise<void>} registerFile
 * @property {(options: { sql: string }) => Promise<ResultTable>} run
 * @typedef {{ columns: string[], rows: ResultRow[], truncated: boolean }} QueryResult
 * @typedef {object} QueryEngine
 * @property {(options: { sql: string }) => Promise<QueryResult>} runQuery
 * @property {() => boolean} isReady  Tells whether the order data is loaded.
 */

/**
 * Wraps SQL so that it returns at most one row more than the limit.
 * The extra row shows that the result was cut.
 * @param {{ sql: string }} options
 * @returns {string}
 */
export function limitedSql({ sql }) {
  return "SELECT * FROM (" + sql + ") AS limited_rows LIMIT " + (MAXIMUM_RESULT_ROWS + 1);
}

/**
 * Creates an engine. The session and the CSV file come in as parameters, so tests need no browser.
 * Side effect: the engine fetches the CSV and runs SQL on the session.
 * @param {object} options
 * @param {() => Promise<DatabaseSession>} options.openSession
 * @param {string} options.csvUrl
 * @param {typeof fetch} [options.fetchImplementation]
 * @returns {QueryEngine}
 */
export function createQueryEngine({ openSession, csvUrl, fetchImplementation = globalThis.fetch.bind(globalThis) }) {
  /** @type {Promise<DatabaseSession> | undefined} */
  let sessionPromise;
  let ready = false;

  /** Opens the session, loads the CSV into the orders table, and locks the database. */
  async function prepareSession() {
    const session = await openSession();
    const response = await fetchImplementation(csvUrl);
    if (!response.ok) throw new DataLoadError({ message: "The order data did not load (status " + response.status + ")." });
    await session.registerFile({ name: CSV_NAME, bytes: new Uint8Array(await response.arrayBuffer()) });
    await session.run({ sql: "CREATE TABLE " + ORDERS_TABLE + " AS SELECT * FROM read_csv('" + CSV_NAME + "', header = true)" });
    // Defense in depth: after the load, the database cannot read files or change its settings.
    await session.run({ sql: "SET enable_external_access = false" });
    await session.run({ sql: "SET lock_configuration = true" });
    ready = true;
    return session;
  }

  /** Returns the one session. A failed start can be tried again. */
  function ensureSession() {
    sessionPromise ??= prepareSession().catch((cause) => {
      sessionPromise = undefined;
      throw cause instanceof DataLoadError ? cause : new DataLoadError({ message: "The database did not start.", cause });
    });
    return sessionPromise;
  }

  return {
    isReady: () => ready,
    async runQuery({ sql }) {
      const safeSql = assertReadOnlyQuery({ sql });
      const session = await ensureSession();
      let table;
      try {
        table = await session.run({ sql: limitedSql({ sql: safeSql }) });
      } catch (cause) {
        throw new QueryFailedError({ message: "The database could not run the query: " + cause.message, sql: safeSql, cause });
      }
      return { columns: table.columns, rows: table.rows.slice(0, MAXIMUM_RESULT_ROWS), truncated: table.rows.length > MAXIMUM_RESULT_ROWS };
    },
  };
}
