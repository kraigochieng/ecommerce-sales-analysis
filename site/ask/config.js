// Settings of the ask panel. Each value has one place to change.

/** The OpenRouter model ID that answers questions (Haiku 5.5). */
export const MODEL_ID = "anthropic/claude-haiku-5.5";

/** The only host that receives the key. */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** The time limit for one request to the model. */
export const REQUEST_TIMEOUT_MILLISECONDS = 60_000;

/** The size limit for one answer from the model. */
export const MAXIMUM_OUTPUT_TOKENS = 2_000;

/** The size limit for the text of a question. */
export const MAXIMUM_QUESTION_LENGTH = 500;

/** The attempts for one step. The second attempt gets the first problem as feedback. */
export const MAXIMUM_ATTEMPTS = 2;

/** The most rows that one query returns to the page. */
export const MAXIMUM_RESULT_ROWS = 200;

/** The most rows that the model sees when it designs the answer. */
export const MAXIMUM_ROWS_SHOWN_TO_MODEL = 40;

/** The A2UI protocol version of the messages. */
export const A2UI_VERSION = "v0.9.1";

/** The surface that holds the answer. */
export const SURFACE_ID = "answer";

/** The catalog ID of the components that the page can draw. */
export const CATALOG_ID = "jumbo-ask-catalog-v1";

/** The name of the table that holds the orders. */
export const ORDERS_TABLE = "orders";
