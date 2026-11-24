import assert from "node:assert/strict";
import { test } from "node:test";

import { isBinding, resolveDynamic, resolvePointer } from "../../../site/ask/data_binding.js";

const MODEL = { rows: [{ region: "Asia", "a/b": 1, "c~d": 2 }] };

test("a pointer reads a nested value", () => {
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/0/region" }), "Asia");
});

test("a pointer decodes ~1 and ~0", () => {
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/0/a~1b" }), 1);
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/0/c~0d" }), 2);
});

test("a missing path gives undefined", () => {
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/5/region" }), undefined);
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/nothing/deep" }), undefined);
});

test("a pointer does not reach inherited properties", () => {
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/map" }), undefined);
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/__proto__" }), undefined);
  assert.equal(resolvePointer({ dataModel: MODEL, pointer: "/rows/0/constructor" }), undefined);
});

test("isBinding accepts only an object with one path key", () => {
  assert.equal(isBinding({ value: { path: "/rows" } }), true);
  assert.equal(isBinding({ value: { path: "rows" } }), false);
  assert.equal(isBinding({ value: { path: "/rows", extra: 1 } }), false);
  assert.equal(isBinding({ value: "/rows" }), false);
  assert.equal(isBinding({ value: null }), false);
});

test("resolveDynamic returns a literal as it is and follows a binding", () => {
  assert.equal(resolveDynamic({ value: "hello", dataModel: MODEL }), "hello");
  assert.equal(resolveDynamic({ value: { path: "/rows/0/region" }, dataModel: MODEL }), "Asia");
});
