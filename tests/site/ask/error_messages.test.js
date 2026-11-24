import assert from "node:assert/strict";
import { test } from "node:test";

import {
  A2uiValidationError,
  DataLoadError,
  InvalidQuestionError,
  KeyMissingError,
  ModelAuthenticationError,
  ModelRequestError,
  ModelResponseError,
  QueryFailedError,
  UnsafeQueryError,
} from "../../../site/ask/errors.js";
import { describeError } from "../../../site/ask/error_messages.js";

const SECRET = "sk-or-v1-example-secret";

const CASES = [
  [new KeyMissingError({ message: "x" }), /Paste your OpenRouter key first/],
  [new InvalidQuestionError({ message: "Type a question first." }), /Type a question first/],
  [new ModelAuthenticationError({ message: "x", status: 401 }), /refused the key/],
  [new ModelRequestError({ message: "OpenRouter says the account has no credit left.", status: 402 }), /no credit left/],
  [new DataLoadError({ message: "The order data did not load (status 500)." }), /did not load \(status 500\)\. Reload the page/],
  [new ModelResponseError({ message: "x" }), /did not give a usable answer/],
  [new A2uiValidationError({ problems: ["x"] }), /cannot draw/],
  [new UnsafeQueryError({ reason: "x", sql: "DROP" }), /does not allow/],
  [new QueryFailedError({ message: "x", sql: "SELECT" }), /did not run/],
  [new TypeError("boom"), /Something went wrong/],
  ["not an error", /Something went wrong/],
];

CASES.forEach(([error, pattern], index) => {
  test("describeError case " + index + " matches " + pattern, () => {
    assert.match(describeError({ error }), pattern);
  });
});

test("no sentence holds a secret that was in the error", () => {
  const error = new ModelRequestError({ message: "failed", status: 0, cause: new Error("Bearer " + SECRET) });
  assert.ok(!describeError({ error }).includes(SECRET));
});
