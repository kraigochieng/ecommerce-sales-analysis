// A live check against the real OpenRouter API. It runs only when OPENROUTER_API_KEY is set
// (for example in the .env file). It costs a fraction of a cent. It never prints the key.

import assert from "node:assert/strict";
import { test } from "node:test";

import { requestCompletion } from "../../../site/ask/openrouter_client.js";

test("live: the default model answers a short question", { skip: !process.env.OPENROUTER_API_KEY }, async () => {
  const text = await requestCompletion({
    apiKey: process.env.OPENROUTER_API_KEY,
    messages: [{ role: "user", content: "Reply with the word ok." }],
    maximumTokens: 16,
  });
  assert.ok(text.length > 0);
});
