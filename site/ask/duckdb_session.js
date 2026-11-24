// Opens a DuckDB-WASM database in the browser. This is the only unit that touches DuckDB-WASM.
// Side effect: starts a worker, loads WASM, and runs SQL.
// The files come from site/vendor/ (built by `npm run vendor`), so no third-party host serves code.

/** Turns one value from an Arrow column into a plain value for the page. */
function plainValue({ value, typeName, scale }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (typeName.startsWith("Date") || typeName.startsWith("Timestamp")) return new Date(Number(value)).toISOString().slice(0, typeName.startsWith("Date") ? 10 : 19);
  if (typeName.startsWith("Decimal")) return Number(String(value)) / 10 ** scale;
  return value;
}

/**
 * Turns an Arrow table into column names and plain rows.
 * @param {{ table: any }} options  An Arrow table from DuckDB-WASM.
 * @returns {{ columns: string[], rows: Record<string, string | number | boolean | null>[] }}
 */
export function tableToRows({ table }) {
  const fields = table.schema.fields;
  const rows = table.toArray().map((row) =>
    Object.fromEntries(fields.map((field) => [field.name, plainValue({ value: row[field.name], typeName: String(field.type), scale: field.type.scale })])),
  );
  return { columns: fields.map((field) => field.name), rows };
}

/**
 * Opens a database session on DuckDB-WASM.
 * @returns {Promise<import("./query_engine.js").DatabaseSession>}
 */
export async function openDuckDbSession() {
  const duckdb = await import("../vendor/duckdb/duckdb-browser.mjs");
  const worker = new Worker(new URL("../vendor/duckdb/duckdb-browser-eh.worker.js", import.meta.url));
  const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await database.instantiate(new URL("../vendor/duckdb/duckdb-eh.wasm", import.meta.url).href);
  const connection = await database.connect();
  return {
    registerFile: ({ name, bytes }) => database.registerFileBuffer(name, bytes),
    run: async ({ sql }) => tableToRows({ table: await connection.query(sql) }),
  };
}
