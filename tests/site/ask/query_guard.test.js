import assert from "node:assert/strict";
import { test } from "node:test";

import { UnsafeQueryError } from "../../../site/ask/errors.js";
import { assertReadOnlyQuery } from "../../../site/ask/query_guard.js";

/** Cases that the guard must allow: the SQL in, the cleaned SQL out. */
const ALLOWED = [
  ["SELECT region, COUNT(*) FROM orders GROUP BY region", "SELECT region, COUNT(*) FROM orders GROUP BY region"],
  ["select * from orders;", "select * from orders"],
  ["SELECT 1;  ", "SELECT 1"],
  ["WITH monthly AS (SELECT order_date_year_month, SUM(revenue) AS total FROM orders GROUP BY 1) SELECT * FROM monthly", "WITH monthly AS (SELECT order_date_year_month, SUM(revenue) AS total FROM orders GROUP BY 1) SELECT * FROM monthly"],
  ["SELECT * FROM orders WHERE region = 'Asia' -- only Asia\n", "SELECT * FROM orders WHERE region = 'Asia'"],
  ["SELECT replace(region, ' ', '_') FROM orders", "SELECT replace(region, ' ', '_') FROM orders"],
  ["SELECT * FROM orders WHERE region = 'DROP; TABLE'", "SELECT * FROM orders WHERE region = 'DROP; TABLE'"],
  ["SELECT updated_at_count FROM orders", "SELECT updated_at_count FROM orders"],
  ["SELECT \"region\" FROM orders", "SELECT \"region\" FROM orders"],
  ["SELECT \"region\" FROM \"orders\"", "SELECT \"region\" FROM \"orders\""],
];

ALLOWED.forEach(([sql, expected]) => {
  test("allowed: " + sql.slice(0, 50), () => {
    assert.equal(assertReadOnlyQuery({ sql }), expected);
  });
});

/** Cases that the guard must refuse: the SQL in, a part of the reason out. */
const REFUSED = [
  ["DROP TABLE orders", /start with SELECT or WITH/],
  ["DELETE FROM orders", /start with SELECT or WITH/],
  ["SELECT 1; DROP TABLE orders", /one statement only/],
  ["SELECT * FROM orders; SELECT 2", /one statement only/],
  ["WITH x AS (SELECT 1) DELETE FROM orders", /word that is not allowed/],
  ["INSERT INTO orders VALUES (1)", /start with SELECT or WITH/],
  ["COPY orders TO 'out.csv'", /start with SELECT or WITH/],
  ["SELECT * FROM read_csv('orders.csv')", /reads files or settings/],
  ["SELECT * FROM READ_PARQUET('x')", /reads files or settings/],
  ["SELECT * FROM glob('*')", /reads files or settings/],
  ["SELECT * FROM 'orders.csv'", /FROM must name a table/],
  ["SELECT * FROM orders JOIN 'x.csv' ON true", /FROM must name a table/],
  ["SELECT * FROM \"orders.csv\"", /dot or a slash/],
  ["SELECT * FROM orders WHERE region = 'Asia", /not closed/],
  ["SELECT * /* open comment FROM orders", /not closed/],
  ["SELECT current_setting('x')", /reads files or settings/],
  ["", /empty/],
  ["   ", /empty/],
  ["SELECT 1 FROM orders WHERE x = '" + "a".repeat(4000) + "'", /longer than 4000/],
];

REFUSED.forEach(([sql, pattern], index) => {
  test("refused " + index + ": " + sql.slice(0, 50), () => {
    assert.throws(() => assertReadOnlyQuery({ sql }), (error) => error instanceof UnsafeQueryError && pattern.test(error.reason));
  });
});

test("a value that is not a string is refused", () => {
  assert.throws(() => assertReadOnlyQuery({ sql: null }), UnsafeQueryError);
  assert.throws(() => assertReadOnlyQuery({ sql: 42 }), UnsafeQueryError);
});

test("the refusal keeps the SQL in a typed field", () => {
  assert.throws(
    () => assertReadOnlyQuery({ sql: "DROP TABLE orders" }),
    (error) => error.sql === "DROP TABLE orders",
  );
});
