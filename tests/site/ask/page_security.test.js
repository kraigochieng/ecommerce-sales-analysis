import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SITE_DIRECTORY = join(import.meta.dirname, "..", "..", "..", "site");
const INDEX_HTML = readFileSync(join(SITE_DIRECTORY, "index.html"), "utf8");

/** Reads the content of the Content-Security-Policy meta tag. */
function readPolicy() {
  return /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(INDEX_HTML)[1];
}

/** Splits a policy into a map from directive name to its sources. */
function parsePolicy({ policy }) {
  return Object.fromEntries(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
}

test("the policy lets the page connect only to itself and to openrouter.ai", () => {
  const directives = parsePolicy({ policy: readPolicy() });
  assert.deepEqual(directives["connect-src"], ["'self'", "https://openrouter.ai"]);
  assert.deepEqual(directives["default-src"], ["'none'"]);
});

test("the policy allows only own scripts and the one inline import map", () => {
  const directives = parsePolicy({ policy: readPolicy() });
  const sources = directives["script-src"];
  assert.equal(sources[0], "'self'");
  assert.equal(sources.length, 2);
  assert.match(sources[1], /^'sha256-[A-Za-z0-9+/=]+'$/);
  assert.ok(!sources.includes("'unsafe-inline'") && !sources.includes("'unsafe-eval'"));
});

test("the hash in the policy matches the inline import map", () => {
  const importMap = /<script type="importmap">([\s\S]*?)<\/script>/.exec(INDEX_HTML)[1];
  const hash = createHash("sha256").update(importMap).digest("base64");
  assert.ok(readPolicy().includes("'sha256-" + hash + "'"));
});

test("the page has no other inline script", () => {
  const inlineScripts = [...INDEX_HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].map((match) => match[0]);
  assert.deepEqual(inlineScripts, ['<script type="importmap">']);
});

test("no source file of the site imports code from another host", () => {
  const files = [...readdirSync(SITE_DIRECTORY).filter((name) => name.endsWith(".js")).map((name) => join(SITE_DIRECTORY, name)),
    ...readdirSync(join(SITE_DIRECTORY, "ask")).map((name) => join(SITE_DIRECTORY, "ask", name))];
  const remoteImports = files.flatMap((path) =>
    [...readFileSync(path, "utf8").matchAll(/(?:import|from)\s*\(?\s*["'](https?:)?\/\/[^"']+["']/g)].map((match) => path + ": " + match[0]));
  assert.deepEqual(remoteImports, []);
});

test("the OpenRouter host appears in one source file only", () => {
  const sources = readdirSync(join(SITE_DIRECTORY, "ask")).filter((name) => readFileSync(join(SITE_DIRECTORY, "ask", name), "utf8").includes("openrouter.ai"));
  assert.deepEqual(sources, ["config.js"]);
});
