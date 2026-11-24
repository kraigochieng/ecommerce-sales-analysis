// The ask panel: wires the form on the page to the ask flow.
// Side effect: reads and changes the DOM, and starts requests through the parts that come in.

import { el } from "../dom.js";
import { renderSurface } from "./a2ui_renderer.js";
import { answerQuestion } from "./ask_flow.js";
import { MAXIMUM_RESULT_ROWS } from "./config.js";
import { AskError } from "./errors.js";
import { describeError } from "./error_messages.js";
import { decideSubmit } from "./panel_state.js";

/**
 * @typedef {object} PanelParts
 * @property {import("./key_store.js").KeyStore} keyStore
 * @property {import("./draft_store.js").DraftStore} draftStore
 * @property {import("./query_engine.js").QueryEngine} engine
 * @property {(options: { apiKey: string, messages: import("./openrouter_client.js").ChatMessage[] }) => Promise<string>} requestCompletion
 */

/**
 * Finds an element that the page must have.
 * @param {{ id: string }} options
 * @returns {HTMLElement}
 */
function requiredElement({ id }) {
  const node = document.getElementById(id);
  if (!node) throw new Error("The ask panel needs the element #" + id + ".");
  return node;
}

/**
 * Builds the block under an answer that shows the query that the model wrote.
 * @param {{ sql: string, truncated: boolean }} options
 * @returns {HTMLElement}
 */
function buildQueryDetails({ sql, truncated }) {
  const details = el("details", { class: "ask-sql" });
  details.appendChild(el("summary", {}, "Show the query"));
  details.appendChild(el("pre", {}, sql));
  if (truncated) details.appendChild(el("p", { class: "ask-caption" }, "The result was cut at " + MAXIMUM_RESULT_ROWS + " rows."));
  return details;
}

/**
 * Starts the ask panel.
 * @param {PanelParts} parts
 * @returns {void}
 */
export function initAskPanel({ keyStore, draftStore, engine, requestCompletion }) {
  const form = requiredElement({ id: "ask-form" });
  const keyInput = requiredElement({ id: "ask-key" });
  const forgetKeyButton = requiredElement({ id: "ask-key-forget" });
  const questionInput = requiredElement({ id: "ask-question" });
  const clearQuestionButton = requiredElement({ id: "ask-question-clear" });
  const submitButton = requiredElement({ id: "ask-submit" });
  const draftStatus = requiredElement({ id: "ask-draft-status" });
  const status = requiredElement({ id: "ask-status" });
  const answer = requiredElement({ id: "ask-answer" });
  /** @type {import("./panel_state.js").PanelStatus} */
  let panelStatus = "idle";

  /** Shows the status line and the state of the Ask button. */
  function showStatus({ next, message, isError = false }) {
    panelStatus = next;
    status.textContent = message;
    status.classList.toggle("ask-status-error", isError);
    submitButton.disabled = next === "loading";
    form.setAttribute("aria-busy", String(next === "loading"));
  }

  /** Draws the outcome of the flow below the form. */
  function showOutcome({ outcome }) {
    if (outcome.kind === "declined") {
      answer.replaceChildren(el("p", { class: "ask-text" }, outcome.reason));
      showStatus({ next: "answered", message: "The data cannot give an answer to this question." });
      return;
    }
    const surfaceHost = el("div");
    answer.replaceChildren(surfaceHost, buildQueryDetails({ sql: outcome.sql, truncated: outcome.result.truncated }));
    renderSurface({ surface: outcome.surface, dataModel: outcome.dataModel, container: surfaceHost });
    showStatus({ next: "answered", message: "Answered from the order data. The model can be wrong. Check the query." });
  }

  /** Asks the question that is in the form. */
  async function runQuestion() {
    answer.replaceChildren();
    showStatus({
      next: "loading",
      message: engine.isReady() ? "Asking the model." : "Loading the order data (first question only), then asking the model.",
    });
    try {
      const outcome = await answerQuestion({
        question: questionInput.value,
        askModel: ({ messages }) => requestCompletion({ apiKey: keyStore.get(), messages }),
        runQuery: ({ sql }) => engine.runQuery({ sql }),
      });
      draftStore.clear();
      draftStatus.textContent = "";
      showOutcome({ outcome });
    } catch (error) {
      if (!(error instanceof AskError)) console.error(error);
      showStatus({ next: "failed", message: describeError({ error }), isError: true });
    }
  }

  /** Handles a press of the Ask button. */
  async function handleSubmit(event) {
    event.preventDefault();
    keyStore.set({ value: keyInput.value });
    const decision = decideSubmit({ status: panelStatus, hasKey: keyStore.isSet(), hasQuestion: questionInput.value.trim() !== "" });
    if (decision.action === "ignore") return;
    if (decision.action === "refuse") {
      showStatus({ next: panelStatus, message: decision.message, isError: true });
      return;
    }
    await runQuestion();
  }

  /** Saves the question as the reader types, and shows the save status. */
  function handleQuestionInput() {
    const text = questionInput.value;
    if (text === "") {
      draftStore.clear();
      draftStatus.textContent = "";
      return;
    }
    draftStatus.textContent = draftStore.save({ text }) ? "Draft saved." : "Draft not saved: this browser blocks storage.";
  }

  /** Empties the question field. */
  function handleClearQuestion() {
    questionInput.value = "";
    handleQuestionInput();
    questionInput.focus();
  }

  /** Forgets the key, in memory and in the field. */
  function handleForgetKey() {
    keyStore.clear();
    keyInput.value = "";
    showStatus({ next: panelStatus, message: "Key forgotten." });
    keyInput.focus();
  }

  questionInput.value = draftStore.load();
  form.addEventListener("submit", handleSubmit);
  questionInput.addEventListener("input", handleQuestionInput);
  clearQuestionButton.addEventListener("click", handleClearQuestion);
  forgetKeyButton.addEventListener("click", handleForgetKey);
  keyInput.addEventListener("input", () => keyStore.set({ value: keyInput.value }));
}
