// Draws a validated A2UI surface with the chart kit of the page.
// Side effect: builds DOM nodes. Every text goes in with textContent, never as HTML.

import { barChart, lineChart, mount, tableView } from "../charts.js";
import { el } from "../dom.js";
import { resolveDynamic, resolvePointer } from "./data_binding.js";
import { barChartOptions, labelText, lineChartOptions, valueFormatter } from "./chart_scale.js";

/**
 * @typedef {object} RenderContext
 * @property {Map<string, Record<string, unknown>>} components
 * @property {unknown} dataModel
 */

/**
 * Builds the card that holds a title, an optional subtitle, and a body.
 * @param {{ title: string, subtitle?: string }} options
 * @returns {{ card: HTMLElement, host: HTMLElement }}
 */
function createCard({ title, subtitle }) {
  const card = el("div", { class: "card" });
  card.appendChild(el("p", { class: "chart-title" }, title));
  if (subtitle) card.appendChild(el("p", { class: "chart-sub" }, subtitle));
  const host = el("div", { class: "chart-host" });
  card.appendChild(host);
  return { card, host };
}

/**
 * Reads the rows that a component points to.
 * @param {{ component: Record<string, unknown>, context: RenderContext }} options
 * @returns {Record<string, unknown>[]}
 */
function rowsOf({ component, context }) {
  return resolvePointer({ dataModel: context.dataModel, pointer: component.data.path });
}

/**
 * Builds a chart component: a card, a chart that fits its width, and a table twin.
 * @param {{ component: Record<string, unknown>, context: RenderContext, draw: Function, optionsFor: Function }} options
 * @returns {HTMLElement}
 */
function renderChart({ component, context, draw, optionsFor }) {
  const rows = rowsOf({ component, context });
  const { card, host } = createCard({ title: component.title, subtitle: component.subtitle });
  const options = optionsFor({ rows, labelKey: component.labelKey, valueKey: component.valueKey, format: component.format, title: component.title });
  mount(host, (hostNode, width) => draw(hostNode, width, options));
  const format = valueFormatter({ format: component.format ?? "number" });
  card.appendChild(
    tableView(
      [component.labelKey, component.valueKey],
      rows.map((row) => [labelText({ value: row[component.labelKey] }), format(Number(row[component.valueKey]))]),
    ),
  );
  return card;
}

/**
 * Builds a table component. The table is open, because it is the answer itself.
 * @param {{ component: Record<string, unknown>, context: RenderContext }} options
 * @returns {HTMLElement}
 */
function renderTable({ component, context }) {
  const rows = rowsOf({ component, context });
  const { card, host } = createCard({ title: component.title });
  const view = tableView(component.columns, rows.map((row) => component.columns.map((column) => labelText({ value: row[column] }))));
  view.open = true;
  host.appendChild(view);
  return card;
}

/**
 * Builds a Stat component.
 * @param {{ component: Record<string, unknown>, context: RenderContext }} options
 * @returns {HTMLElement}
 */
function renderStat({ component, context }) {
  const resolved = resolveDynamic({ value: component.value, dataModel: context.dataModel });
  const text = typeof resolved === "number" ? valueFormatter({ format: component.format ?? "number" })(resolved) : resolved;
  const chip = el("div", { class: "chip" });
  chip.append(el("p", { class: "chip-label" }, component.label), el("p", { class: "chip-value" }, text));
  return chip;
}

/** The tag and the class for each text variant. */
const TEXT_VARIANT_NODES = Object.freeze({
  h2: { tag: "h3", className: "ask-headline" },
  body: { tag: "p", className: "ask-text" },
  caption: { tag: "p", className: "ask-caption" },
});

/**
 * Builds a Text component.
 * @param {{ component: Record<string, unknown>, context: RenderContext }} options
 * @returns {HTMLElement}
 */
function renderText({ component, context }) {
  const { tag, className } = TEXT_VARIANT_NODES[component.variant ?? "body"];
  const resolved = resolveDynamic({ value: component.text, dataModel: context.dataModel });
  return el(tag, { class: className }, String(resolved));
}

/**
 * Builds a Column component and its children.
 * @param {{ component: Record<string, unknown>, context: RenderContext }} options
 * @returns {HTMLElement}
 */
function renderColumn({ component, context }) {
  const column = el("div", { class: "ask-column" });
  column.append(...component.children.map((childId) => renderComponent({ id: childId, context })));
  return column;
}

/** One render function for each component in the catalog. */
const RENDERERS = Object.freeze({
  Column: renderColumn,
  Text: renderText,
  Stat: renderStat,
  BarChart: ({ component, context }) => renderChart({ component, context, draw: barChart, optionsFor: barChartOptions }),
  LineChart: ({ component, context }) => renderChart({ component, context, draw: lineChart, optionsFor: lineChartOptions }),
  Table: renderTable,
});

/**
 * Builds the DOM node of one component and of its children.
 * @param {{ id: string, context: RenderContext }} options
 * @returns {HTMLElement}
 */
function renderComponent({ id, context }) {
  const component = context.components.get(id);
  return RENDERERS[component.component]({ component, context });
}

/**
 * Draws a validated surface into a container and replaces what was there.
 * @param {{ surface: { rootId: string, components: Map<string, Record<string, unknown>> }, dataModel: unknown, container: HTMLElement }} options
 * @returns {void}
 */
export function renderSurface({ surface, dataModel, container }) {
  const context = { components: surface.components, dataModel };
  container.replaceChildren(renderComponent({ id: surface.rootId, context }));
}
