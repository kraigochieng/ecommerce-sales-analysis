import assert from "node:assert/strict";
import { test } from "node:test";

import { ModelResponseError } from "../../../site/ask/errors.js";
import { extractJson } from "../../../site/ask/json_extraction.js";

test("plain JSON parses", () => {
  assert.deepEqual(extractJson({ text: '{"sql": "SELECT 1"}' }), { sql: "SELECT 1" });
});

test("a fenced block parses", () => {
  const text = "Here you go:\n```json\n{\"sql\": \"SELECT 1\"}\n```\nDone.";
  assert.deepEqual(extractJson({ text }), { sql: "SELECT 1" });
});

test("JSON inside other text parses", () => {
  assert.deepEqual(extractJson({ text: 'Sure. {"a": [1, 2]} Hope it helps.' }), { a: [1, 2] });
});

test("an array parses", () => {
  assert.deepEqual(extractJson({ text: '[{"a": 1}]' }), [{ a: 1 }]);
});

test("text with no JSON raises ModelResponseError", () => {
  assert.throws(() => extractJson({ text: "I cannot do that." }), ModelResponseError);
});

test("broken JSON raises ModelResponseError", () => {
  assert.throws(() => extractJson({ text: '{"a": ' }), ModelResponseError);
});
