import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ModelAuthenticationError,
  ModelRequestError,
  ModelResponseError,
} from "../../../site/ask/errors.js";
import { errorForStatus, requestCompletion, textFromCompletion } from "../../../site/ask/openrouter_client.js";

const SECRET = "sk-or-v1-example-secret";
const MESSAGES = [{ role: "user", content: "Say ok." }];

/** Builds a fake fetch that returns one response and records the request. */
function fakeFetch({ status = 200, body }) {
  const calls = [];
  const implementation = async (url, init) => {
    calls.push({ url, init });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status });
  };
  return { implementation, calls };
}

const GOOD_BODY = { choices: [{ message: { content: "ok" } }] };

test("a good answer returns the text of the first choice", async () => {
  const { implementation } = fakeFetch({ body: GOOD_BODY });
  const text = await requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: implementation });
  assert.equal(text, "ok");
});

test("the request goes only to OpenRouter, with the key, and refuses redirects", async () => {
  const { implementation, calls } = fakeFetch({ body: GOOD_BODY });
  await requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: implementation });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer " + SECRET);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(JSON.parse(calls[0].init.body).model, "anthropic/claude-haiku-5.5");
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test("status 401 raises ModelAuthenticationError", async () => {
  const { implementation } = fakeFetch({ status: 401, body: { error: { message: "bad" } } });
  await assert.rejects(
    requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: implementation }),
    (error) => error instanceof ModelAuthenticationError && error.status === 401,
  );
});

test("status 402 and 429 give their own message", () => {
  assert.match(errorForStatus({ status: 402 }).message, /no credit/);
  assert.match(errorForStatus({ status: 429 }).message, /too many requests/);
});

test("status 500 raises ModelRequestError with the status", async () => {
  const { implementation } = fakeFetch({ status: 500, body: "server error" });
  await assert.rejects(
    requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: implementation }),
    (error) => error instanceof ModelRequestError && error.status === 500,
  );
});

test("a network failure raises ModelRequestError and keeps the cause", async () => {
  const cause = new TypeError("fetch failed");
  const failing = async () => {
    throw cause;
  };
  await assert.rejects(
    requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: failing }),
    (error) => error instanceof ModelRequestError && error.status === 0 && error.cause === cause,
  );
});

test("a body that is not JSON raises ModelResponseError", async () => {
  const { implementation } = fakeFetch({ body: "<html>" });
  await assert.rejects(
    requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: implementation }),
    ModelResponseError,
  );
});

test("an empty answer raises ModelResponseError", () => {
  assert.throws(() => textFromCompletion({ body: { choices: [{ message: { content: "  " } }] } }), ModelResponseError);
  assert.throws(() => textFromCompletion({ body: {} }), ModelResponseError);
});

test("no error message contains the key", async () => {
  const failing = async () => {
    throw new TypeError("fetch failed for " + "Bearer " + SECRET);
  };
  await assert.rejects(
    requestCompletion({ apiKey: SECRET, messages: MESSAGES, fetchImplementation: failing }),
    (error) => !error.message.includes(SECRET),
  );
});
