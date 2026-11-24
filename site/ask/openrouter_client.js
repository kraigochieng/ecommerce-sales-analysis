// The only unit that talks to OpenRouter. It sends the key to one host and nowhere else.

import {
  MAXIMUM_OUTPUT_TOKENS,
  MODEL_ID,
  OPENROUTER_BASE_URL,
  REQUEST_TIMEOUT_MILLISECONDS,
} from "./config.js";
import {
  ModelAuthenticationError,
  ModelRequestError,
  ModelResponseError,
} from "./errors.js";

/**
 * @typedef {object} ChatMessage
 * @property {"system" | "user" | "assistant"} role
 * @property {string} content
 */

/** The reason that the reader sees for each HTTP status that needs its own text. */
const STATUS_MESSAGES = Object.freeze({
  402: "OpenRouter says the account has no credit left.",
  429: "OpenRouter says there are too many requests. Wait and try again.",
});

/**
 * Turns an HTTP status that is not a success into the typed error for it.
 * @param {{ status: number }} options
 * @returns {ModelAuthenticationError | ModelRequestError}
 */
export function errorForStatus({ status }) {
  if (status === 401 || status === 403) {
    return new ModelAuthenticationError({ message: "OpenRouter refused the key.", status });
  }
  const message = STATUS_MESSAGES[status] ?? "OpenRouter answered with status " + status + ".";
  return new ModelRequestError({ message, status });
}

/**
 * Reads the text of the first choice in a chat completion body.
 * @param {{ body: unknown }} options
 * @returns {string}
 */
export function textFromCompletion({ body }) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new ModelResponseError({ message: "The model sent an empty answer." });
  }
  return content;
}

/**
 * Sends one chat request to OpenRouter and returns the text of the answer.
 * Side effect: network request. The request does not follow redirects.
 * @param {object} options
 * @param {string} options.apiKey
 * @param {ChatMessage[]} options.messages
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImplementation]  Injected for tests.
 * @param {number} [options.timeoutMilliseconds]
 * @param {number} [options.maximumTokens]
 * @returns {Promise<string>}
 */
export async function requestCompletion({
  apiKey,
  messages,
  model = MODEL_ID,
  fetchImplementation = globalThis.fetch.bind(globalThis),
  timeoutMilliseconds = REQUEST_TIMEOUT_MILLISECONDS,
  maximumTokens = MAXIMUM_OUTPUT_TOKENS,
}) {
  let response;
  try {
    response = await fetchImplementation(OPENROUTER_BASE_URL + "/chat/completions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMilliseconds),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({ model, messages, max_tokens: maximumTokens, temperature: 0 }),
    });
  } catch (cause) {
    throw new ModelRequestError({
      message: "The request to OpenRouter failed. Check the network and try again.",
      status: 0,
      cause,
    });
  }
  if (!response.ok) throw errorForStatus({ status: response.status });
  return textFromCompletion({ body: await parseJsonBody({ response }) });
}

/**
 * Reads the JSON body of a response.
 * @param {{ response: Response }} options
 * @returns {Promise<unknown>}
 */
async function parseJsonBody({ response }) {
  try {
    return await response.json();
  } catch (cause) {
    throw new ModelResponseError({ message: "OpenRouter sent a body that is not JSON.", cause });
  }
}
