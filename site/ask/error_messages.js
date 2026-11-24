// Turns an error into the sentence that the reader sees. No sentence holds a secret.

import {
  A2uiValidationError,
  AskError,
  DataLoadError,
  InvalidQuestionError,
  KeyMissingError,
  ModelAuthenticationError,
  ModelRequestError,
  ModelResponseError,
  QueryFailedError,
  UnsafeQueryError,
} from "./errors.js";

const TRY_AGAIN = " Try again, or ask in other words.";

/** The sentence for each error type, as a function of the error. Checked in order. */
const MESSAGE_RULES = [
  [KeyMissingError, () => "Paste your OpenRouter key first."],
  [InvalidQuestionError, (error) => error.message],
  [ModelAuthenticationError, () => "OpenRouter refused the key. Check the key and try again."],
  [ModelRequestError, (error) => error.message],
  [DataLoadError, (error) => error.message + " Reload the page and try again."],
  [ModelResponseError, () => "The model did not give a usable answer." + TRY_AGAIN],
  [A2uiValidationError, () => "The model designed an answer that the page cannot draw." + TRY_AGAIN],
  [UnsafeQueryError, () => "The model wrote a query that the page does not allow." + TRY_AGAIN],
  [QueryFailedError, () => "The model wrote a query that did not run." + TRY_AGAIN],
  [AskError, (error) => error.message],
];

/**
 * Writes the sentence that the reader sees for an error.
 * @param {{ error: unknown }} options
 * @returns {string}
 */
export function describeError({ error }) {
  const rule = MESSAGE_RULES.find(([type]) => error instanceof type);
  return rule ? rule[1](error) : "Something went wrong. Reload the page and try again.";
}
