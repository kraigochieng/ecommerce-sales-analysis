import assert from "node:assert/strict";
import { test } from "node:test";

import { createDraftStore } from "../../../site/ask/draft_store.js";

/** Builds a fake storage that keeps items in a map. */
function fakeStorage({ blocked = false } = {}) {
  const items = new Map();
  const guard = () => {
    if (blocked) throw new DOMException("blocked", "SecurityError");
  };
  return {
    items,
    getItem: (key) => (guard(), items.get(key) ?? null),
    setItem: (key, value) => (guard(), items.set(key, value)),
    removeItem: (key) => (guard(), items.delete(key)),
  };
}

test("save then load returns the text", () => {
  const store = createDraftStore({ storage: fakeStorage() });
  assert.equal(store.save({ text: "Which region?" }), true);
  assert.equal(store.load(), "Which region?");
});

test("load returns an empty string when nothing is saved", () => {
  assert.equal(createDraftStore({ storage: fakeStorage() }).load(), "");
});

test("clear removes the draft", () => {
  const store = createDraftStore({ storage: fakeStorage() });
  store.save({ text: "x" });
  assert.equal(store.clear(), true);
  assert.equal(store.load(), "");
});

test("blocked storage reports false and loads an empty string", () => {
  const store = createDraftStore({ storage: fakeStorage({ blocked: true }) });
  assert.equal(store.save({ text: "x" }), false);
  assert.equal(store.clear(), false);
  assert.equal(store.load(), "");
});

test("missing storage reports false", () => {
  const store = createDraftStore({ storage: undefined });
  assert.equal(store.save({ text: "x" }), false);
  assert.equal(store.load(), "");
});

test("the draft uses its own key and holds nothing else", () => {
  const storage = fakeStorage();
  createDraftStore({ storage }).save({ text: "x" });
  assert.deepEqual([...storage.items.keys()], ["ask-question-draft"]);
});
