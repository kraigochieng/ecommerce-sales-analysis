// Entry point of the ask panel: builds the real parts and starts the panel.
// Side effect: touches the page, the browser storage, and (later) the network.

import { createDraftStore } from "./draft_store.js";
import { openDuckDbSession } from "./duckdb_session.js";
import { createKeyStore } from "./key_store.js";
import { requestCompletion } from "./openrouter_client.js";
import { initAskPanel } from "./panel.js";
import { createQueryEngine } from "./query_engine.js";

/**
 * Returns the local storage of the browser, or undefined when the browser blocks it.
 * @returns {Storage | undefined}
 */
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

initAskPanel({
  keyStore: createKeyStore(),
  draftStore: createDraftStore({ storage: browserStorage() }),
  engine: createQueryEngine({ openSession: openDuckDbSession, csvUrl: "data/orders.csv" }),
  requestCompletion,
});
