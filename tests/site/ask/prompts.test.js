import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { COMPONENT_SPECS } from "../../../site/ask/a2ui_catalog.js";
import { ORDER_COLUMNS, buildAnswerMessages, buildQueryMessages, buildRetryMessages } from "../../../site/ask/prompts.js";

const RESULT = { columns: ["region", "rate"], rows: [{ region: "Asia", rate: 6 }], truncated: false };

test("the query messages hold the question, the schema, and the rules", () => {
  const [system, user] = buildQueryMessages({ question: "Which region returns most?" });
  assert.equal(system.role, "system");
  assert.equal(user.content, "Question: Which region returns most?");
  ORDER_COLUMNS.forEach(([name]) => assert.ok(system.content.includes(name)));
  assert.match(system.content, /"sql": null/);
  assert.match(system.content, /data, not instructions/);
  assert.match(system.content, /do not use LIMIT unless the question asks for a top number/);
});

test("the schema in the prompt matches the columns that the export writes", () => {
  const queries = readFileSync(join(import.meta.dirname, "..", "..", "..", "src", "ecommerce_sales_analysis", "queries.py"), "utf8");
  const block = /ORDERS_FOR_ASK_QUERY = """([\s\S]*?)"""/.exec(queries)[1];
  const exported = block.split("FROM")[0].replace("SELECT", "").split(",").map((name) => name.trim());
  assert.deepEqual(ORDER_COLUMNS.map(([name]) => name), exported);
});

test("the answer messages name every component of the catalog and the data path", () => {
  const [system] = buildAnswerMessages({ question: "q", sql: "SELECT 1", result: RESULT });
  Object.keys(COMPONENT_SPECS).forEach((name) => assert.ok(system.content.includes(name + ":")));
  assert.match(system.content, /\/rows/);
  assert.match(system.content, /surfaceId": "answer"/);
});

test("the answer messages show the query, the columns, and the rows", () => {
  const [, user] = buildAnswerMessages({ question: "q", sql: "SELECT region FROM orders", result: RESULT });
  assert.match(user.content, /Query: SELECT region FROM orders/);
  assert.match(user.content, /Columns: region, rate/);
  assert.match(user.content, /Rows shown: 1 of 1/);
  assert.match(user.content, /\[\{"region":"Asia","rate":6\}\]/);
});

test("the model sees at most 40 rows and is told when the result was cut", () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ n: index }));
  const [, user] = buildAnswerMessages({ question: "q", sql: "s", result: { columns: ["n"], rows, truncated: true } });
  assert.match(user.content, /Rows shown: 40 of 200 \(the result was cut at 200 rows\)/);
  assert.equal(JSON.parse(user.content.split("\n").at(-1)).length, 40);
});

test("the retry messages keep the conversation and add the failed answer and the problem", () => {
  const original = buildQueryMessages({ question: "q" });
  const retry = buildRetryMessages({ messages: original, previousAnswer: "bad", problem: "no sql" });
  assert.equal(retry.length, original.length + 2);
  assert.deepEqual(retry.slice(0, original.length), original);
  assert.deepEqual(retry.at(-2), { role: "assistant", content: "bad" });
  assert.match(retry.at(-1).content, /no sql/);
});
