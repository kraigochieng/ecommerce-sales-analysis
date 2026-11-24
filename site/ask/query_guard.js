// Decides whether SQL from the model is safe to run: one read-only SELECT.
// The check works on text, so it is a second line of defense. The first is that the
// database holds only a copy of the public order data in memory.

import { UnsafeQueryError } from "./errors.js";

const MAXIMUM_SQL_LENGTH = 4_000;

/** Matches a quoted text, a quoted name, a line comment, or a block comment. */
const MASKABLE = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;

/** Words that start or hide a statement that is not a read. */
const DENIED_WORDS = /\b(insert|update|delete|drop|create|alter|attach|detach|copy|export|import|install|load|pragma|set|call|checkpoint|vacuum|truncate|begin|commit|rollback|use|force|prepare|execute|explain|describe|show|summarize)\b/i;

/** Functions that read files, URLs, settings, or the environment. */
const DENIED_FUNCTIONS = /\b(read_\w+|glob|parquet_\w+|sniff_csv|duckdb_\w+|pragma_\w+|query_table|getenv|current_setting|iceberg_\w+|delta_scan|http\w*)\b|\bquery\s*\(/i;

/** A file path used as a table: FROM 'file.csv'. A quoted name is checked apart. */
const FILE_AS_TABLE = /\b(from|join)\s+\$string\b/i;

/**
 * Removes the comments from SQL and keeps the rest as written.
 * @param {{ sql: string }} options
 * @returns {string}
 */
function withoutComments({ sql }) {
  return sql.replace(MASKABLE, (match) => (match.startsWith("--") || match.startsWith("/*") ? " " : match));
}

/**
 * Replaces each text and each quoted name with a marker, so that words inside them do not count.
 * @param {{ sql: string }} options
 * @returns {string}
 */
function maskLiterals({ sql }) {
  return sql.replace(MASKABLE, (match) => {
    if (match.startsWith("'")) return " $STRING ";
    if (match.startsWith('"')) return " $NAME ";
    return " ";
  });
}

/**
 * Lists the quoted names in SQL, without their quotes.
 * @param {{ sql: string }} options
 * @returns {string[]}
 */
function quotedNames({ sql }) {
  return [...sql.matchAll(MASKABLE)].map((match) => match[0]).filter((text) => text.startsWith('"')).map((text) => text.slice(1, -1));
}

/**
 * Finds the reason that SQL is not allowed, or returns undefined when it is allowed.
 * @param {{ sql: string, masked: string }} options
 * @returns {string | undefined}
 */
function findRefusalReason({ sql, masked }) {
  const body = masked.trim().replace(/;\s*$/, "");
  const rules = [
    [sql.length > MAXIMUM_SQL_LENGTH, "the query is longer than " + MAXIMUM_SQL_LENGTH + " characters"],
    [/['"]|\/\*/.test(body), "a quote or a comment is not closed"],
    [body.includes(";"), "send one statement only"],
    [!/^(select|with)\b/i.test(body), "the query must start with SELECT or WITH"],
    [DENIED_WORDS.test(body), "the query uses a word that is not allowed for a read-only query"],
    [DENIED_FUNCTIONS.test(body), "the query uses a function that reads files or settings"],
    [FILE_AS_TABLE.test(body), "FROM must name a table, not a file"],
    [quotedNames({ sql }).some((name) => /[./\\]/.test(name)), "a quoted name holds a dot or a slash"],
  ];
  return rules.find(([broken]) => broken)?.[1];
}

/**
 * Checks that SQL is one read-only SELECT and returns it without comments and without the last semicolon.
 * @param {{ sql: unknown }} options
 * @returns {string}
 * @throws {UnsafeQueryError} with the reason for the refusal.
 */
export function assertReadOnlyQuery({ sql }) {
  if (typeof sql !== "string" || sql.trim() === "") {
    throw new UnsafeQueryError({ reason: "the query is empty", sql: String(sql) });
  }
  const reason = findRefusalReason({ sql, masked: maskLiterals({ sql }) });
  if (reason) throw new UnsafeQueryError({ reason, sql });
  return withoutComments({ sql }).trim().replace(/;\s*$/, "").trim();
}
