// Pure helpers that turn result rows into the options of the chart kit (site/charts.js).

const NICE_STEPS = Object.freeze([1, 2, 2.5, 5, 10]);
const MAXIMUM_X_LABELS = 6;
const LINE_CHART_HEIGHT = 230;

/**
 * Rounds a maximum up to a round number, such as 1, 2, 2.5, or 5 times a power of ten.
 * @param {{ maximum: number }} options
 * @returns {number}
 */
export function niceMaximum({ maximum }) {
  if (!(maximum > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= maximum * (1 - 1e-9));
  return step * magnitude;
}

/**
 * Builds a function that writes a number in one of the catalog formats.
 * @param {{ format: "number" | "percent" | "compact" }} options
 * @returns {(value: number) => string}
 */
export function valueFormatter({ format }) {
  const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const formatters = {
    number: (value) => plain.format(value),
    percent: (value) => plain.format(value) + "%",
    compact: (value) => compact.format(value),
  };
  return formatters[format] ?? formatters.number;
}

/**
 * Turns a result value into text for a label.
 * @param {{ value: unknown }} options
 * @returns {string}
 */
export function labelText({ value }) {
  return value === null || value === undefined ? "(none)" : String(value);
}

/**
 * Builds the options for the bar chart of the chart kit.
 * @param {{ rows: Record<string, unknown>[], labelKey: string, valueKey: string, format?: string, title: string }} options
 * @returns {object}
 */
export function barChartOptions({ rows, labelKey, valueKey, format = "number", title }) {
  const formatText = valueFormatter({ format });
  const values = rows.map((row) => Number(row[valueKey]));
  const largest = Math.max(...values);
  const largestIndex = values.indexOf(largest);
  return {
    data: rows.map((row, index) => ({
      label: labelText({ value: row[labelKey] }),
      value: values[index],
      highlight: rows.length > 1 && index === largestIndex,
    })),
    max: niceMaximum({ maximum: largest }),
    format: formatText,
    allAccent: rows.length === 1,
    ariaLabel: "Bar chart: " + title + ". Highest: " + labelText({ value: rows[largestIndex][labelKey] }) + ", " + formatText(largest) + ".",
  };
}

/**
 * Picks the indexes of the x labels: a few, evenly spaced, with the first and the last.
 * @param {{ count: number }} options
 * @returns {number[]}
 */
export function xLabelIndexes({ count }) {
  const labels = Math.min(count, MAXIMUM_X_LABELS);
  const indexes = Array.from({ length: labels }, (_, position) => Math.round((position * (count - 1)) / Math.max(1, labels - 1)));
  return [...new Set(indexes)];
}

/**
 * Builds the options for the line chart of the chart kit.
 * The y axis starts at zero, or below zero when a value is negative.
 * @param {{ rows: Record<string, unknown>[], labelKey: string, valueKey: string, format?: string, title: string }} options
 * @returns {object}
 */
export function lineChartOptions({ rows, labelKey, valueKey, format = "number", title }) {
  const formatText = valueFormatter({ format });
  const values = rows.map((row) => Number(row[valueKey]));
  const largest = Math.max(...values);
  const smallest = Math.min(...values);
  const yMax = niceMaximum({ maximum: largest });
  const yMin = smallest < 0 ? -niceMaximum({ maximum: -smallest }) : 0;
  const largestIndex = values.indexOf(largest);
  const labels = rows.map((row) => labelText({ value: row[labelKey] }));
  return {
    data: rows.map((row, index) => ({
      label: labels[index],
      value: values[index],
      tag: index === largestIndex ? formatText(values[index]) : undefined,
    })),
    highlight: new Set([largestIndex]),
    lineColor: "var(--accent)",
    yMin,
    yMax,
    yTicks: Array.from({ length: 5 }, (_, position) => yMin + ((yMax - yMin) * position) / 4),
    yFormat: formatText,
    valueFormat: formatText,
    xTicks: xLabelIndexes({ count: rows.length }).map((index) => ({ index, label: labels[index] })),
    height: LINE_CHART_HEIGHT,
    ariaLabel: "Line chart: " + title + ". Highest: " + labels[largestIndex] + ", " + formatText(largest) + ".",
  };
}
