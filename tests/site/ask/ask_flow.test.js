import assert from "node:assert/strict";
import { test } from "node:test";

import { answerQuestion, assertValidQuestion } from "../../../site/ask/ask_flow.js";
import {
  A2uiValidationError,
  DataLoadError,
  InvalidQuestionError,
  ModelAuthenticationError,
  ModelResponseError,
  UnsafeQueryError,
} from "../../../site/ask/errors.js";

const RESULT = { columns: ["region", "rate"], rows: [{ region: "Asia", rate: 6.1 }, { region: "Africa", rate: 5.7 }], truncated: false };

const PLAN = JSON.stringify({ sql: "SELECT region, rate FROM orders" });

const GOOD_DESIGN = JSON.stringify({
  version: "v0.9.1",
  updateComponents: {
    surfaceId: "answer",
    components: [
      { id: "root", component: "Column", children: ["headline", "bars"] },
      { id: "headline", component: "Text", text: "Asia returns the most.", variant: "h2" },
      { id: "bars", component: "BarChart", title: "Rate", data: { path: "/rows" }, labelKey: "region", valueKey: "rate", format: "percent" },
    ],
  },
});

const BAD_DESIGN = JSON.stringify({
  version: "v0.9.1",
  updateComponents: { surfaceId: "answer", components: [{ id: "root", component: "Script" }] },
});

/** Builds a model that returns the given answers in order and records each call. */
function scriptedModel({ answers }) {
  const calls = [];
  const askModel = async ({ messages }) => {
    calls.push(messages);
    const next = answers[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  };
  return { askModel, calls };
}

/** Builds a database that returns the given result and records each query. */
function fakeDatabase({ result = RESULT, failures = [] } = {}) {
  const queries = [];
  const runQuery = async ({ sql }) => {
    queries.push(sql);
    const failure = failures[queries.length - 1];
    if (failure) throw failure;
    return result;
  };
  return { runQuery, queries };
}

test("a good question gives a checked answer, with the query and the rows", async () => {
  const { askModel, calls } = scriptedModel({ answers: [PLAN, GOOD_DESIGN] });
  const { runQuery, queries } = fakeDatabase();
  const outcome = await answerQuestion({ question: "  Which region returns most?  ", askModel, runQuery });
  assert.equal(outcome.kind, "answer");
  assert.equal(outcome.sql, "SELECT region, rate FROM orders");
  assert.deepEqual(outcome.dataModel, { rows: RESULT.rows });
  assert.equal(outcome.surface.components.size, 3);
  assert.deepEqual(queries, ["SELECT region, rate FROM orders"]);
  assert.equal(calls.length, 2);
  assert.match(calls[0][1].content, /Which region returns most\?$/);
});

test("a model that says the data cannot answer ends the flow with its reason", async () => {
  const { askModel, calls } = scriptedModel({ answers: [JSON.stringify({ sql: null, reason: "There is no cost data." })] });
  const { runQuery, queries } = fakeDatabase();
  const outcome = await answerQuestion({ question: "What is the profit?", askModel, runQuery });
  assert.deepEqual(outcome, { kind: "declined", reason: "There is no cost data." });
  assert.equal(calls.length, 1);
  assert.equal(queries.length, 0);
});

test("a query with no rows ends the flow with a plain reason", async () => {
  const { askModel } = scriptedModel({ answers: [PLAN] });
  const { runQuery } = fakeDatabase({ result: { columns: ["n"], rows: [], truncated: false } });
  const outcome = await answerQuestion({ question: "q", askModel, runQuery });
  assert.deepEqual(outcome, { kind: "declined", reason: "No orders match this question." });
});

test("an unsafe query gets one retry with the reason, and the second query is used", async () => {
  const unsafe = new UnsafeQueryError({ reason: "the query must start with SELECT or WITH", sql: "DROP TABLE orders" });
  const { askModel, calls } = scriptedModel({ answers: [JSON.stringify({ sql: "DROP TABLE orders" }), PLAN, GOOD_DESIGN] });
  const { runQuery, queries } = fakeDatabase({ failures: [unsafe] });
  const outcome = await answerQuestion({ question: "q", askModel, runQuery });
  assert.equal(outcome.kind, "answer");
  assert.equal(queries.length, 2);
  assert.match(calls[1].at(-1).content, /must start with SELECT or WITH/);
});

test("an answer that breaks the catalog gets one retry with the problems", async () => {
  const { askModel, calls } = scriptedModel({ answers: [PLAN, BAD_DESIGN, GOOD_DESIGN] });
  const outcome = await answerQuestion({ question: "q", askModel, runQuery: fakeDatabase().runQuery });
  assert.equal(outcome.kind, "answer");
  assert.equal(calls.length, 3);
  assert.match(calls[2].at(-1).content, /unknown component "Script"/);
});

test("an answer that breaks the catalog twice raises A2uiValidationError", async () => {
  const { askModel, calls } = scriptedModel({ answers: [PLAN, BAD_DESIGN, BAD_DESIGN] });
  await assert.rejects(answerQuestion({ question: "q", askModel, runQuery: fakeDatabase().runQuery }), A2uiValidationError);
  assert.equal(calls.length, 3);
});

test("a plan that is not JSON twice raises ModelResponseError", async () => {
  const { askModel } = scriptedModel({ answers: ["I will not.", "Still not."] });
  await assert.rejects(answerQuestion({ question: "q", askModel, runQuery: fakeDatabase().runQuery }), ModelResponseError);
});

test("a plan without a sql key gets a retry", async () => {
  const { askModel, calls } = scriptedModel({ answers: [JSON.stringify({ query: "x" }), PLAN, GOOD_DESIGN] });
  await answerQuestion({ question: "q", askModel, runQuery: fakeDatabase().runQuery });
  assert.match(calls[1].at(-1).content, /"sql" key/);
});

test("a key that OpenRouter refuses is not retried", async () => {
  const refusal = new ModelAuthenticationError({ message: "OpenRouter refused the key.", status: 401 });
  const { askModel, calls } = scriptedModel({ answers: [refusal] });
  await assert.rejects(answerQuestion({ question: "q", askModel, runQuery: fakeDatabase().runQuery }), ModelAuthenticationError);
  assert.equal(calls.length, 1);
});

test("a database that does not load is not retried", async () => {
  const { askModel, calls } = scriptedModel({ answers: [PLAN] });
  const { runQuery } = fakeDatabase({ failures: [new DataLoadError({ message: "The order data did not load (status 500)." })] });
  await assert.rejects(answerQuestion({ question: "q", askModel, runQuery }), DataLoadError);
  assert.equal(calls.length, 1);
});

test("an empty question and a question that is too long are refused before any call", async () => {
  const { askModel, calls } = scriptedModel({ answers: [] });
  const { runQuery } = fakeDatabase();
  await assert.rejects(answerQuestion({ question: "   ", askModel, runQuery }), InvalidQuestionError);
  await assert.rejects(answerQuestion({ question: "x".repeat(501), askModel, runQuery }), InvalidQuestionError);
  assert.equal(calls.length, 0);
});

test("assertValidQuestion trims the text and accepts 500 characters", () => {
  assert.equal(assertValidQuestion({ question: "  hi  " }), "hi");
  assert.equal(assertValidQuestion({ question: "x".repeat(500) }).length, 500);
  assert.throws(() => assertValidQuestion({ question: undefined }), InvalidQuestionError);
});
