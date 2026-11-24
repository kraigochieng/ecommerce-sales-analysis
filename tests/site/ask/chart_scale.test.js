import assert from "node:assert/strict";
import { test } from "node:test";

import { barChartOptions, labelText, lineChartOptions, niceMaximum, valueFormatter, xLabelIndexes } from "../../../site/ask/chart_scale.js";

const NICE_CASES = [
  [0, 1],
  [-5, 1],
  [0.7, 1],
  [1, 1],
  [1.2, 2],
  [2.1, 2.5],
  [4.9, 5],
  [7.5, 10],
  [12.2, 20],
  [6.28, 10],
  [99, 100],
  [250, 250],
  [12438433.06, 20000000],
];

NICE_CASES.forEach(([maximum, expected]) => {
  test("niceMaximum(" + maximum + ") is " + expected, () => {
    assert.equal(niceMaximum({ maximum }), expected);
  });
});

test("number format groups thousands and keeps two decimals", () => {
  assert.equal(valueFormatter({ format: "number" })(1234567.891), "1,234,567.89");
});

test("percent format adds a percent sign", () => {
  assert.equal(valueFormatter({ format: "percent" })(12.2), "12.2%");
});

test("compact format shortens large numbers", () => {
  assert.equal(valueFormatter({ format: "compact" })(12438433), "12.4M");
});

test("an unknown format falls back to number", () => {
  assert.equal(valueFormatter({ format: "bogus" })(1000), "1,000");
});

test("labelText writes none for a missing value", () => {
  assert.equal(labelText({ value: null }), "(none)");
  assert.equal(labelText({ value: 2025 }), "2025");
});

const ROWS = [
  { region: "Asia", rate: 6.06 },
  { region: "Oceania", rate: 6.28 },
  { region: "Africa", rate: 5.75 },
];

test("bar options highlight the largest bar and set a round maximum", () => {
  const options = barChartOptions({ rows: ROWS, labelKey: "region", valueKey: "rate", format: "percent", title: "Return rate" });
  assert.deepEqual(options.data.map((bar) => bar.highlight), [false, true, false]);
  assert.equal(options.max, 10);
  assert.equal(options.format(6.28), "6.28%");
  assert.match(options.ariaLabel, /Highest: Oceania, 6.28%/);
});

test("a single bar is drawn in the accent color", () => {
  const options = barChartOptions({ rows: [ROWS[0]], labelKey: "region", valueKey: "rate", title: "T" });
  assert.equal(options.allAccent, true);
  assert.equal(options.data[0].highlight, false);
});

test("line options start the axis at zero and tag the highest point", () => {
  const options = lineChartOptions({ rows: ROWS, labelKey: "region", valueKey: "rate", format: "percent", title: "T" });
  assert.equal(options.yMin, 0);
  assert.equal(options.yMax, 10);
  assert.deepEqual(options.yTicks, [0, 2.5, 5, 7.5, 10]);
  assert.deepEqual([...options.highlight], [1]);
  assert.equal(options.data[1].tag, "6.28%");
});

test("line options go below zero when a value is negative", () => {
  const rows = [{ label: "a", value: -3 }, { label: "b", value: 4 }];
  const options = lineChartOptions({ rows, labelKey: "label", valueKey: "value", title: "T" });
  assert.equal(options.yMin, -5);
  assert.equal(options.yMax, 5);
});

test("x labels include the first and the last point, and at most six", () => {
  assert.deepEqual(xLabelIndexes({ count: 2 }), [0, 1]);
  assert.deepEqual(xLabelIndexes({ count: 3 }), [0, 1, 2]);
  const many = xLabelIndexes({ count: 36 });
  assert.equal(many.length, 6);
  assert.equal(many[0], 0);
  assert.equal(many.at(-1), 35);
});
