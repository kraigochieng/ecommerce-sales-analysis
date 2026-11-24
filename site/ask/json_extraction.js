// Reads the JSON value inside the text of a model answer.

import { ModelResponseError } from "./errors.js";

const FENCED_BLOCK = /```(?:json)?\s*([\s\S]*?)```/i;

/**
 * Tries to parse text as JSON.
 * @param {{ text: string }} options
 * @returns {{ ok: true, value: unknown } | { ok: false }}
 */
function tryParse({ text }) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Lists the texts that may hold the JSON value: the whole answer, a fenced block,
 * and the span from the first brace or bracket to the last one.
 * @param {{ text: string }} options
 * @returns {string[]}
 */
function candidateTexts({ text }) {
  const fenced = FENCED_BLOCK.exec(text)?.[1];
  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  const span = start >= 0 && end > start ? text.slice(start, end + 1) : undefined;
  return [text.trim(), fenced?.trim(), span].filter((candidate) => candidate);
}

/**
 * Returns the JSON value in the text of a model answer.
 * @param {{ text: string }} options
 * @returns {unknown}
 * @throws {ModelResponseError} when no candidate parses.
 */
export function extractJson({ text }) {
  const parsed = candidateTexts({ text })
    .map((candidate) => tryParse({ text: candidate }))
    .find((attempt) => attempt.ok);
  if (!parsed) throw new ModelResponseError({ message: "The model answer is not valid JSON." });
  return parsed.value;
}
