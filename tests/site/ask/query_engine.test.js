import assert from "node:assert/strict";
import { test } from "node:test";

import { DataLoadError, QueryFailedError, UnsafeQueryError } from "../../../site/ask/errors.js";
import { createQueryEngine, limitedSql } from "../../../site/ask/query_engine.js";

/** Builds a fake session that records its calls and answers each query with the given table. */
function fakeSession({ table = { columns: ["n"], rows: [{ n: 1 }] }, failOn } = {}) {
  const calls = { registered: [], queries: [] };
  const session = {
    registerFile: async ({ name, bytes }) => calls.registered.push({ name, size: bytes.length }),
    run: async ({ sql }) => {
      calls.queries.push(sql);
      if (failOn && sql.includes(failOn)) throw new Error("Binder Error: no column");
      return table;
    },
  };
  return { session, calls };
}

/** Builds a fake fetch that serves a small CSV file. */
function fakeFetch({ status = 200 } = {}) {
  return async () => new Response("a,b\n1,2\n", { status });
}

test("the first query loads the data into the orders table", async () => {
  const { session, calls } = fakeSession();
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "data/orders.csv", fetchImplementation: fakeFetch() });
  assert.equal(engine.isReady(), false);
  await engine.runQuery({ sql: "SELECT 1 AS n" });
  assert.equal(engine.isReady(), true);
  assert.deepEqual(calls.registered, [{ name: "orders.csv", size: 8 }]);
  assert.match(calls.queries[0], /^CREATE TABLE orders AS SELECT \* FROM read_csv\('orders.csv'/);
});

test("the database is locked after the data loads", async () => {
  const { session, calls } = fakeSession();
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  await engine.runQuery({ sql: "SELECT 1" });
  assert.deepEqual(calls.queries.slice(1, 3), ["SET enable_external_access = false", "SET lock_configuration = true"]);
});

test("the data loads once for many queries", async () => {
  const { session, calls } = fakeSession();
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  await engine.runQuery({ sql: "SELECT 1" });
  await engine.runQuery({ sql: "SELECT 2" });
  assert.equal(calls.registered.length, 1);
  assert.equal(calls.queries.filter((sql) => sql.startsWith("CREATE TABLE")).length, 1);
});

test("the query runs inside a limit wrapper and the comments are gone", async () => {
  const { session, calls } = fakeSession();
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  await engine.runQuery({ sql: "SELECT 1 -- note\n;" });
  assert.equal(calls.queries.at(-1), limitedSql({ sql: "SELECT 1" }));
  assert.match(calls.queries.at(-1), /LIMIT 201$/);
});

test("a result with more than 200 rows is cut and marked", async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ n: index }));
  const { session } = fakeSession({ table: { columns: ["n"], rows } });
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  const result = await engine.runQuery({ sql: "SELECT n FROM orders" });
  assert.equal(result.rows.length, 200);
  assert.equal(result.truncated, true);
});

test("a result of 200 rows is not marked as cut", async () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ n: index }));
  const { session } = fakeSession({ table: { columns: ["n"], rows } });
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  const result = await engine.runQuery({ sql: "SELECT n FROM orders" });
  assert.equal(result.truncated, false);
});

test("SQL that is not read-only is refused before the database is touched", async () => {
  const { session, calls } = fakeSession();
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  await assert.rejects(engine.runQuery({ sql: "DROP TABLE orders" }), UnsafeQueryError);
  assert.equal(calls.queries.length, 0);
});

test("a database error raises QueryFailedError with the SQL and the cause", async () => {
  const { session } = fakeSession({ failOn: "ghost" });
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: fakeFetch() });
  await assert.rejects(
    engine.runQuery({ sql: "SELECT ghost FROM orders" }),
    (error) => error instanceof QueryFailedError && error.sql === "SELECT ghost FROM orders" && /Binder Error/.test(error.message) && error.cause instanceof Error,
  );
});

test("a CSV that does not load raises DataLoadError and a later query can try again", async () => {
  const { session } = fakeSession();
  let status = 500;
  const engine = createQueryEngine({ openSession: async () => session, csvUrl: "x", fetchImplementation: async () => new Response("a\n1\n", { status }) });
  await assert.rejects(engine.runQuery({ sql: "SELECT 1" }), (error) => error instanceof DataLoadError && /status 500/.test(error.message));
  status = 200;
  const result = await engine.runQuery({ sql: "SELECT 1" });
  assert.equal(result.rows.length, 1);
});

test("a session that does not open raises DataLoadError", async () => {
  const engine = createQueryEngine({
    openSession: async () => {
      throw new Error("no worker");
    },
    csvUrl: "x",
    fetchImplementation: fakeFetch(),
  });
  await assert.rejects(engine.runQuery({ sql: "SELECT 1" }), (error) => error instanceof DataLoadError && error.cause instanceof Error);
});
