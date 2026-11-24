// Copies the DuckDB-WASM files that the ask panel needs from node_modules
// into site/vendor/, so the page serves them from its own origin.
// Side effect: writes files under site/vendor/.

import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDirectory = join(repositoryRoot, "node_modules");
const vendorDirectory = join(repositoryRoot, "site", "vendor");

/** One copy job: a source path under node_modules and a target path under site/vendor. */
const COPY_JOBS = [
  { source: "@duckdb/duckdb-wasm/dist/duckdb-browser.mjs", target: "duckdb/duckdb-browser.mjs" },
  { source: "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js", target: "duckdb/duckdb-browser-eh.worker.js" },
  { source: "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", target: "duckdb/duckdb-eh.wasm" },
  { source: "apache-arrow", target: "apache-arrow" },
  { source: "flatbuffers/mjs", target: "flatbuffers/mjs" },
  { source: "tslib/tslib.es6.mjs", target: "tslib/tslib.es6.mjs" },
];

/** Tells whether a path is a folder to enter or a file that a browser loads. */
function isServedPath(sourcePath) {
  if (statSync(sourcePath).isDirectory()) return basename(sourcePath) !== "bin";
  return /\.(mjs|js|wasm)$/.test(sourcePath) && !sourcePath.endsWith(".d.ts");
}

/** Copies one source into site/vendor. */
function runCopyJob({ source, target }) {
  const targetPath = join(vendorDirectory, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(join(modulesDirectory, source), targetPath, { recursive: true, filter: isServedPath });
  console.log("vendored " + source);
}

rmSync(vendorDirectory, { recursive: true, force: true });
COPY_JOBS.forEach(runCopyJob);
