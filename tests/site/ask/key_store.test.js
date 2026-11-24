import assert from "node:assert/strict";
import { inspect } from "node:util";
import { test } from "node:test";

import { createKeyStore } from "../../../site/ask/key_store.js";

const SECRET = "sk-or-v1-example-secret";

test("a new store holds no key", () => {
  const store = createKeyStore();
  assert.equal(store.isSet(), false);
  assert.equal(store.get(), "");
});

test("set keeps the key and trims spaces around it", () => {
  const store = createKeyStore();
  store.set({ value: "  " + SECRET + "\n" });
  assert.equal(store.get(), SECRET);
  assert.equal(store.isSet(), true);
});

test("clear forgets the key", () => {
  const store = createKeyStore();
  store.set({ value: SECRET });
  store.clear();
  assert.equal(store.isSet(), false);
  assert.equal(store.get(), "");
});

test("a space-only value counts as no key", () => {
  const store = createKeyStore();
  store.set({ value: "   " });
  assert.equal(store.isSet(), false);
});

test("the key does not appear in JSON, in a string, or in an inspection", () => {
  const store = createKeyStore();
  store.set({ value: SECRET });
  assert.ok(!JSON.stringify(store).includes(SECRET));
  assert.ok(!String(store).includes(SECRET));
  assert.ok(!inspect(store, { showHidden: true, depth: 5 }).includes(SECRET));
  assert.ok(!Object.values(store).includes(SECRET));
});

test("the store cannot be changed from outside", () => {
  const store = createKeyStore();
  assert.throws(() => {
    "use strict";
    store.get = () => "stolen";
  }, TypeError);
});
