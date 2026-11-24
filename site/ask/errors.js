// Expected failures of the ask panel. Each one has a typed field for its context.
// No message holds a secret.

/** The base of every expected failure of the ask panel. */
export class AskError extends Error {
  /** Stores the message and the original error, when there is one. */
  constructor({ message, cause }) {
    super(message, { cause });
    this.name = new.target.name;
  }
}

/** The reader asked with no key. */
export class KeyMissingError extends AskError {}

/** The question is empty or too long. */
export class InvalidQuestionError extends AskError {}

/** OpenRouter refused the key. */
export class ModelAuthenticationError extends AskError {
  /** Stores the HTTP status that OpenRouter sent. */
  constructor({ message, status, cause }) {
    super({ message, cause });
    this.status = status;
  }
}

/** The request to OpenRouter failed (network, time limit, credit, rate limit, or server error). */
export class ModelRequestError extends AskError {
  /** Stores the HTTP status, or 0 when no response arrived. */
  constructor({ message, status, cause }) {
    super({ message, cause });
    this.status = status;
  }
}

/** The model answered, but the answer is not usable (empty, or not JSON). */
export class ModelResponseError extends AskError {}

/** The model wrote A2UI messages that break the catalog. */
export class A2uiValidationError extends AskError {
  /** Stores the list of problems, in plain text. */
  constructor({ problems }) {
    super({ message: "The answer breaks the A2UI catalog: " + problems.join(" ") });
    this.problems = problems;
  }
}

/** The model wrote SQL that is not one read-only SELECT. */
export class UnsafeQueryError extends AskError {
  /** Stores the SQL and the reason for the refusal. */
  constructor({ reason, sql }) {
    super({ message: "The query is not allowed: " + reason });
    this.reason = reason;
    this.sql = sql;
  }
}

/** The order data or the database did not load. */
export class DataLoadError extends AskError {}

/** The database failed to run the query. */
export class QueryFailedError extends AskError {
  /** Stores the SQL that failed. */
  constructor({ message, sql, cause }) {
    super({ message, cause });
    this.sql = sql;
  }
}
