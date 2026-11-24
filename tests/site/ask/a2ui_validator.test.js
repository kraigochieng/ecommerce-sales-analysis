import assert from "node:assert/strict";
import { test } from "node:test";

import { COMPONENT_SPECS, describeCatalog } from "../../../site/ask/a2ui_catalog.js";
import { A2uiValidationError } from "../../../site/ask/errors.js";
import { validateSurface } from "../../../site/ask/a2ui_validator.js";

const DATA_MODEL = {
  rows: [
    { region: "Asia", return_rate: 7.5, month: "2025-01" },
    { region: "Europe", return_rate: 6.1, month: "2025-02" },
    { region: "Africa", return_rate: 5.9, month: "2025-03" },
  ],
};

/** Wraps components in one valid updateComponents message. */
function message(components) {
  return { version: "v0.9.1", updateComponents: { surfaceId: "answer", components } };
}

const ROOT_WITH_TEXT = message([
  { id: "root", component: "Column", children: ["headline"] },
  { id: "headline", component: "Text", text: "Asia returns the most.", variant: "h2" },
]);

/** Returns the problems of a failing validation. */
function problemsOf({ messages, dataModel = DATA_MODEL }) {
  try {
    validateSurface({ messages, dataModel });
  } catch (error) {
    assert.ok(error instanceof A2uiValidationError);
    return error.problems.join("\n");
  }
  return assert.fail("The validation should fail.");
}

test("a root column with one text is valid", () => {
  const surface = validateSurface({ messages: ROOT_WITH_TEXT, dataModel: DATA_MODEL });
  assert.equal(surface.rootId, "root");
  assert.deepEqual([...surface.components.keys()], ["root", "headline"]);
});

test("a list of messages is valid and a later message replaces an earlier component", () => {
  const surface = validateSurface({
    messages: [ROOT_WITH_TEXT, message([{ id: "headline", component: "Text", text: "New." }])],
    dataModel: DATA_MODEL,
  });
  assert.equal(surface.components.get("headline").text, "New.");
});

test("a bar chart, a line chart, a stat, and a table bound to the rows are valid", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["stat", "bars", "line", "table"] },
    { id: "stat", component: "Stat", label: "Top rate", value: { path: "/rows/0/return_rate" }, format: "percent" },
    { id: "bars", component: "BarChart", title: "Rate", data: { path: "/rows" }, labelKey: "region", valueKey: "return_rate", format: "percent" },
    { id: "line", component: "LineChart", title: "Trend", data: { path: "/rows" }, labelKey: "month", valueKey: "return_rate" },
    { id: "table", component: "Table", title: "Rows", data: { path: "/rows" }, columns: ["region", "return_rate"] },
  ]);
  assert.equal(validateSurface({ messages, dataModel: DATA_MODEL }).components.size, 5);
});

test("a message that is not an object is refused", () => {
  assert.match(problemsOf({ messages: "hello" }), /Message 1 is not an object/);
});

test("a wrong surfaceId is refused", () => {
  const messages = { updateComponents: { surfaceId: "other", components: [] } };
  assert.match(problemsOf({ messages }), /surfaceId must be "answer"/);
});

test("createSurface and updateDataModel are refused, because the page owns them", () => {
  const messages = [
    { createSurface: { surfaceId: "answer", catalogId: "x" } },
    { updateDataModel: { surfaceId: "answer", value: {} } },
  ];
  const problems = problemsOf({ messages });
  assert.match(problems, /"createSurface" is not allowed/);
  assert.match(problems, /"updateDataModel" is not allowed/);
});

test("a wrong version is refused", () => {
  const messages = { version: "v0.1", updateComponents: { surfaceId: "answer", components: ROOT_WITH_TEXT.updateComponents.components } };
  assert.match(problemsOf({ messages }), /version must be "v0.9.1"/);
});

test("an unknown component is refused and the catalog is named", () => {
  const messages = message([{ id: "root", component: "Script", src: "x" }]);
  assert.match(problemsOf({ messages }), /unknown component "Script"\. Use one of: Column, Text/);
});

test("an inherited name such as constructor is not a component", () => {
  const messages = message([{ id: "root", component: "constructor" }]);
  assert.match(problemsOf({ messages }), /unknown component "constructor"/);
});

test("an unknown property is refused", () => {
  const messages = message([{ id: "root", component: "Column", children: [], onclick: "x" }, ]);
  assert.match(problemsOf({ messages }), /unknown property "onclick"/);
});

test("a missing required property is refused", () => {
  const messages = message([{ id: "root", component: "Column" }]);
  assert.match(problemsOf({ messages }), /missing required property "children"/);
});

test("a message with no root is refused", () => {
  const messages = message([{ id: "headline", component: "Text", text: "Hi" }]);
  assert.match(problemsOf({ messages }), /No component has the id "root"/);
});

test("a missing child is refused", () => {
  const messages = message([{ id: "root", component: "Column", children: ["ghost"] }]);
  assert.match(problemsOf({ messages }), /child "ghost", but no component has that id/);
});

test("a child with two parents is refused", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["a", "b"] },
    { id: "a", component: "Column", children: ["leaf"] },
    { id: "b", component: "Column", children: ["leaf"] },
    { id: "leaf", component: "Text", text: "x" },
  ]);
  assert.match(problemsOf({ messages }), /"leaf" is a child more than once/);
});

test("a root that is a child is refused, so a cycle cannot happen", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["a"] },
    { id: "a", component: "Column", children: ["root"] },
  ]);
  assert.match(problemsOf({ messages }), /root component cannot be a child/);
});

test("a tree that is too deep is refused", () => {
  const chain = ["root", "a", "b", "c", "d", "e", "f"].map((id, index, ids) =>
    index === ids.length - 1 ? { id, component: "Text", text: "x" } : { id, component: "Column", children: [ids[index + 1]] });
  assert.match(problemsOf({ messages: message(chain) }), /7 levels deep/);
});

test("too many components are refused", () => {
  const leaves = Array.from({ length: 31 }, (_, index) => ({ id: "t" + index, component: "Text", text: "x" }));
  const messages = message([{ id: "root", component: "Column", children: ["t0"] }, ...leaves]);
  assert.match(problemsOf({ messages }), /32 components/);
});

test("a text that is too long is refused", () => {
  const messages = message([{ id: "root", component: "Column", children: ["t"] }, { id: "t", component: "Text", text: "x".repeat(601) }]);
  assert.match(problemsOf({ messages }), /property text must be a short text or a binding/);
});

test("a binding to a missing value is refused", () => {
  const messages = message([{ id: "root", component: "Column", children: ["t"] }, { id: "t", component: "Text", text: { path: "/rows/9/region" } }]);
  assert.match(problemsOf({ messages }), /points to \/rows\/9\/region, which holds no text or number/);
});

test("a bar chart with a key that is not a column is refused", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["bars"] },
    { id: "bars", component: "BarChart", title: "T", data: { path: "/rows" }, labelKey: "country", valueKey: "return_rate" },
  ]);
  assert.match(problemsOf({ messages }), /labelKey "country" is not a column/);
});

test("a bar chart with a negative or non-number value is refused", () => {
  const negative = { rows: [{ label: "a", value: -1 }] };
  const text = { rows: [{ label: "a", value: "5" }] };
  const messages = message([
    { id: "root", component: "Column", children: ["bars"] },
    { id: "bars", component: "BarChart", title: "T", data: { path: "/rows" }, labelKey: "label", valueKey: "value" },
  ]);
  assert.match(problemsOf({ messages, dataModel: negative }), /numbers of zero or more/);
  assert.match(problemsOf({ messages, dataModel: text }), /numbers of zero or more/);
});

test("a line chart with one row is refused", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["line"] },
    { id: "line", component: "LineChart", title: "T", data: { path: "/rows" }, labelKey: "month", valueKey: "return_rate" },
  ]);
  assert.match(problemsOf({ messages, dataModel: { rows: [DATA_MODEL.rows[0]] } }), /needs 2 to 400 rows, but \/rows has 1/);
});

test("a table with a column that is not in the rows is refused", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["table"] },
    { id: "table", component: "Table", title: "T", data: { path: "/rows" }, columns: ["region", "ghost"] },
  ]);
  assert.match(problemsOf({ messages }), /column "ghost" is not a column/);
});

test("a format that is not in the catalog is refused", () => {
  const messages = message([
    { id: "root", component: "Column", children: ["s"] },
    { id: "s", component: "Stat", label: "L", value: "5", format: "euro" },
  ]);
  assert.match(problemsOf({ messages }), /must be one of: number, percent, compact/);
});

test("many problems are cut to a short list", () => {
  const leaves = Array.from({ length: 12 }, (_, index) => ({ id: "t" + index, component: "Bogus" }));
  const problems = problemsOf({ messages: message(leaves) });
  assert.match(problems, /And \d+ more problems/);
});

test("the catalog description names every component", () => {
  const description = describeCatalog();
  Object.keys(COMPONENT_SPECS).forEach((name) => assert.ok(description.includes(name + ":")));
});
