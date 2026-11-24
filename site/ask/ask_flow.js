// The steps from a question to an answer: write a query, run it, design the answer, check it.
// The model client and the database come in as parameters, so tests need neither.
// Side effect: each step calls the model or the database through those parameters.

import { validateSurface } from "./a2ui_validator.js";
import { MAXIMUM_ATTEMPTS, MAXIMUM_QUESTION_LENGTH } from "./config.js";
import {
  A2uiValidationError,
  InvalidQuestionError,
  ModelResponseError,
  QueryFailedError,
  UnsafeQueryError,
} from "./errors.js";
import { extractJson } from "./json_extraction.js";
import { buildAnswerMessages, buildQueryMessages, buildRetryMessages } from "./prompts.js";

/**
 * @typedef {import("./openrouter_client.js").ChatMessage} ChatMessage
 * @typedef {import("./query_engine.js").QueryResult} QueryResult
 * @typedef {(options: { messages: ChatMessage[] }) => Promise<string>} AskModel
 * @typedef {(options: { sql: string }) => Promise<QueryResult>} RunQuery
 * @typedef {{ kind: "declined", reason: string }} Declined
 * @typedef {{ kind: "answer", sql: string, result: QueryResult, surface: import("./a2ui_validator.js").ValidSurface, dataModel: { rows: QueryResult["rows"] } }} Answer
 */

/**
 * Checks the text of a question.
 * @param {{ question: unknown }} options
 * @returns {string} the question without spaces at its ends.
 * @throws {InvalidQuestionError}
 */
export function assertValidQuestion({ question }) {
  const text = typeof question === "string" ? question.trim() : "";
  if (text === "") throw new InvalidQuestionError({ message: "Type a question first." });
  if (text.length > MAXIMUM_QUESTION_LENGTH) {
    throw new InvalidQuestionError({ message: "The question is longer than " + MAXIMUM_QUESTION_LENGTH + " characters." });
  }
  return text;
}

/**
 * Tells whether the model can fix an error when it sees the problem.
 * @param {{ error: unknown }} options
 * @returns {boolean}
 */
function isRepairable({ error }) {
  return [ModelResponseError, A2uiValidationError, UnsafeQueryError, QueryFailedError].some((type) => error instanceof type);
}

/**
 * Asks the model, and checks the answer with `accept`. When the model can fix a problem, asks once more with the problem.
 * @template T
 * @param {{ messages: ChatMessage[], askModel: AskModel, accept: (options: { text: string }) => Promise<T>, attemptsLeft: number }} options
 * @returns {Promise<T>}
 */
async function askUntilAccepted({ messages, askModel, accept, attemptsLeft }) {
  const text = await askModel({ messages });
  try {
    return await accept({ text });
  } catch (error) {
    if (!isRepairable({ error }) || attemptsLeft <= 1) throw error;
    const retryMessages = buildRetryMessages({ messages, previousAnswer: text, problem: error.message });
    return askUntilAccepted({ messages: retryMessages, askModel, accept, attemptsLeft: attemptsLeft - 1 });
  }
}

/**
 * Reads the plan of the model and runs its query.
 * @param {{ text: string, runQuery: RunQuery }} options
 * @returns {Promise<Declined | { kind: "query", sql: string, result: QueryResult }>}
 */
async function acceptPlan({ text, runQuery }) {
  const plan = extractJson({ text });
  if (typeof plan !== "object" || plan === null || !("sql" in plan)) {
    throw new ModelResponseError({ message: 'The answer must be JSON with a "sql" key.' });
  }
  if (plan.sql === null) return { kind: "declined", reason: String(plan.reason ?? "The data cannot answer this question.") };
  if (typeof plan.sql !== "string") throw new ModelResponseError({ message: 'The "sql" key must hold text.' });
  const result = await runQuery({ sql: plan.sql });
  if (result.rows.length === 0) return { kind: "declined", reason: "No orders match this question." };
  return { kind: "query", sql: plan.sql, result };
}

/**
 * Reads the design of the model and checks it against the catalog and the rows.
 * @param {{ text: string, dataModel: { rows: QueryResult["rows"] } }} options
 * @returns {Promise<import("./a2ui_validator.js").ValidSurface>}
 */
async function acceptDesign({ text, dataModel }) {
  return validateSurface({ messages: extractJson({ text }), dataModel });
}

/**
 * Answers one question about the orders.
 * @param {{ question: string, askModel: AskModel, runQuery: RunQuery }} options
 * @returns {Promise<Declined | Answer>}
 * @throws {import("./errors.js").AskError} when a step fails and cannot be fixed.
 */
export async function answerQuestion({ question, askModel, runQuery }) {
  const cleanQuestion = assertValidQuestion({ question });
  const plan = await askUntilAccepted({
    messages: buildQueryMessages({ question: cleanQuestion }),
    askModel,
    accept: ({ text }) => acceptPlan({ text, runQuery }),
    attemptsLeft: MAXIMUM_ATTEMPTS,
  });
  if (plan.kind === "declined") return plan;
  const dataModel = { rows: plan.result.rows };
  const surface = await askUntilAccepted({
    messages: buildAnswerMessages({ question: cleanQuestion, sql: plan.sql, result: plan.result }),
    askModel,
    accept: ({ text }) => acceptDesign({ text, dataModel }),
    attemptsLeft: MAXIMUM_ATTEMPTS,
  });
  return { kind: "answer", sql: plan.sql, result: plan.result, surface, dataModel };
}
