import assert from "node:assert/strict";
import { test } from "node:test";

import { decideSubmit } from "../../../site/ask/panel_state.js";

/** The rows of the decision table: the inputs, then the action and the message. */
const DECISIONS = [
  [{ status: "loading", hasKey: true, hasQuestion: true }, "ignore", ""],
  [{ status: "loading", hasKey: false, hasQuestion: false }, "ignore", ""],
  [{ status: "idle", hasKey: false, hasQuestion: true }, "refuse", "Paste your OpenRouter key first."],
  [{ status: "idle", hasKey: false, hasQuestion: false }, "refuse", "Paste your OpenRouter key first."],
  [{ status: "idle", hasKey: true, hasQuestion: false }, "refuse", "Type a question first."],
  [{ status: "idle", hasKey: true, hasQuestion: true }, "start", ""],
  [{ status: "answered", hasKey: true, hasQuestion: true }, "start", ""],
  [{ status: "failed", hasKey: true, hasQuestion: true }, "start", ""],
  [{ status: "failed", hasKey: false, hasQuestion: true }, "refuse", "Paste your OpenRouter key first."],
];

DECISIONS.forEach(([input, action, message]) => {
  test("decideSubmit " + JSON.stringify(input) + " is " + action, () => {
    assert.deepEqual(decideSubmit(input), { action, message });
  });
});
