// Small SVG chart kit: line chart, horizontal bar chart, tooltip, table view.
// Colors come from CSS custom properties so light and dark themes both work.
// Text is always set with textContent, because labels come from data.

import { el, svgEl } from "./dom.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// --- mounting --------------------------------------------------------------

// Draws a chart at the width of its host and redraws when the host resizes.
export function mount(host, draw) {
  let lastWidth = 0;
  const run = () => {
    const width = Math.floor(host.clientWidth);
    if (width < 200 || width === lastWidth) return;
    lastWidth = width;
    host.replaceChildren();
    draw(host, width);
  };
  new ResizeObserver(run).observe(host);
  run();
  return { redraw() { lastWidth = 0; run(); } };
}

// --- tooltip ---------------------------------------------------------------

function makeTooltip(host) {
  const tip = el("div", { class: "tip", role: "status" });
  tip.hidden = true;
  const value = el("div", { class: "tip-value" });
  const label = el("div", { class: "tip-label" });
  tip.append(value, label);
  host.appendChild(tip);

  return {
    show(x, y, valueText, labelText) {
      value.textContent = valueText;
      label.textContent = labelText;
      tip.hidden = false;
      const hostWidth = host.clientWidth;
      const tipWidth = tip.offsetWidth;
      const left = x + 14 + tipWidth > hostWidth ? x - 14 - tipWidth : x + 14;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, y - 12)}px`;
    },
    hide() { tip.hidden = true; },
  };
}

function text(svg, attrs, content) {
  svg.appendChild(svgEl("text", { "font-family": FONT, ...attrs }, content));
}

// --- line chart ------------------------------------------------------------

/**
 * o.data       [{ label, value, tag? }]  tag is a short text shown above a highlighted point
 * o.highlight  Set of indexes drawn as accent dots with a label
 * o.yMin, o.yMax, o.yTicks, o.yFormat, o.valueFormat
 * o.xTicks     [{ index, label }]
 * o.lineColor  CSS color for the line (default: muted ink)
 */
export function lineChart(host, width, o) {
  const m = { l: 52, r: 28, t: 24, b: 28 };
  const h = o.height || 200;
  const iw = width - m.l - m.r;
  const ih = h - m.t - m.b;
  const n = o.data.length;
  const highlight = o.highlight || new Set();
  const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => m.t + (1 - (v - o.yMin) / (o.yMax - o.yMin)) * ih;

  const svg = svgEl("svg", {
    width, height: h, viewBox: `0 0 ${width} ${h}`, role: "img",
    "aria-label": o.ariaLabel, tabindex: 0,
  });

  for (const t of o.yTicks) {
    svg.appendChild(svgEl("line", { x1: m.l, x2: width - m.r, y1: y(t), y2: y(t), stroke: "var(--grid)", "stroke-width": 1 }));
    text(svg, { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", "font-size": 12, fill: "var(--ink-3)" }, o.yFormat(t));
  }
  svg.appendChild(svgEl("line", { x1: m.l, x2: width - m.r, y1: y(o.yMin), y2: y(o.yMin), stroke: "var(--axis)", "stroke-width": 1 }));
  for (const t of o.xTicks) {
    text(svg, { x: x(t.index), y: h - 8, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-3)" }, t.label);
  }

  svg.appendChild(svgEl("polyline", {
    points: o.data.map((d, i) => `${x(i)},${y(d.value)}`).join(" "),
    fill: "none", stroke: o.lineColor || "var(--ink-3)", "stroke-width": 2,
    "stroke-linecap": "round", "stroke-linejoin": "round",
  }));

  for (const i of highlight) {
    const d = o.data[i];
    svg.appendChild(svgEl("circle", { cx: x(i), cy: y(d.value), r: 5, fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2 }));
    if (d.tag) {
      // Tags near the left or right edge grow inward, away from the axis labels.
      const anchor = x(i) - m.l < 24 ? "start" : width - m.r - x(i) < 24 ? "end" : "middle";
      text(svg, { x: x(i), y: y(d.value) - 12, "text-anchor": anchor, "font-size": 12, "font-weight": 600, fill: "var(--ink)" }, d.tag);
    }
  }

  const cross = svgEl("line", { y1: m.t, y2: y(o.yMin), stroke: "var(--axis)", "stroke-width": 1, visibility: "hidden" });
  const dot = svgEl("circle", { r: 4, fill: "var(--ink)", stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" });
  svg.append(cross, dot);

  const tip = makeTooltip(host);
  let active = -1;
  const activate = (i) => {
    active = i;
    const d = o.data[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(d.value)); dot.setAttribute("visibility", "visible");
    tip.show(x(i), y(d.value), (o.valueFormat || o.yFormat)(d.value), d.label);
  };
  const deactivate = () => {
    active = -1;
    cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hide();
  };

  const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
  hit.addEventListener("pointermove", (e) => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    activate(Math.min(n - 1, Math.max(0, Math.round(((px - m.l) / iw) * (n - 1)))));
  });
  hit.addEventListener("pointerleave", deactivate);
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = active < 0 ? 0 : active + (e.key === "ArrowRight" ? 1 : -1);
    activate(Math.min(n - 1, Math.max(0, next)));
  });
  svg.addEventListener("blur", deactivate);
  svg.appendChild(hit);

  host.prepend(svg);
}

// --- horizontal bar chart --------------------------------------------------

/**
 * o.data       [{ label, value, highlight?, detail? }]  detail is extra tooltip text
 * o.max        axis maximum
 * o.format     value formatter
 * o.allAccent  draw every bar in the accent color
 * o.refLine    { value, label } vertical reference line
 */
export function barChart(host, width, o) {
  const rowH = 34, barH = 20, labelW = Math.min(112, Math.round(width * 0.3));
  const m = { l: labelW + 10, r: 64, t: o.refLine ? 28 : 8, b: 8 };
  const n = o.data.length;
  const h = m.t + n * rowH + m.b;
  const iw = width - m.l - m.r;
  const x = (v) => m.l + (v / o.max) * iw;

  const svg = svgEl("svg", { width, height: h, viewBox: `0 0 ${width} ${h}`, role: "img", "aria-label": o.ariaLabel });
  svg.appendChild(svgEl("line", { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b, stroke: "var(--axis)", "stroke-width": 1 }));

  if (o.refLine) {
    const rx = x(o.refLine.value);
    svg.appendChild(svgEl("line", { x1: rx, x2: rx, y1: m.t - 6, y2: h - m.b, stroke: "var(--ink-3)", "stroke-width": 1 }));
    text(svg, { x: rx, y: m.t - 12, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" }, o.refLine.label);
  }

  const tip = makeTooltip(host);
  o.data.forEach((d, i) => {
    const top = m.t + i * rowH;
    const cy = top + rowH / 2;
    const w = Math.max(0, x(d.value) - m.l);
    const fill = o.allAccent || d.highlight ? "var(--accent)" : "var(--muted-mark)";

    text(svg, { x: m.l - 10, y: cy + 4, "text-anchor": "end", "font-size": 13, fill: "var(--ink-2)" }, d.label);

    // Square at the baseline, 4px rounded at the data end.
    const by = cy - barH / 2;
    const r = Math.min(4, w / 2);
    const bar = svgEl("path", {
      d: `M${m.l},${by} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${barH - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z`,
      fill,
    });
    svg.appendChild(bar);
    text(svg, { x: m.l + w + 8, y: cy + 4, "font-size": 13, "font-weight": 600, fill: "var(--ink)" }, o.format(d.value));

    const hit = svgEl("rect", { x: 0, y: top, width, height: rowH, fill: "transparent", tabindex: 0, "aria-label": `${d.label}: ${o.format(d.value)}` });
    const on = () => { bar.setAttribute("opacity", 0.8); tip.show(m.l + w, cy, o.format(d.value), d.detail ? `${d.label} · ${d.detail}` : d.label); };
    const off = () => { bar.removeAttribute("opacity"); tip.hide(); };
    hit.addEventListener("pointerenter", on);
    hit.addEventListener("pointerleave", off);
    hit.addEventListener("focus", on);
    hit.addEventListener("blur", off);
    svg.appendChild(hit);
  });

  host.prepend(svg);
}

// --- table view (the accessible twin of a chart) ---------------------------

export function tableView(columns, rows) {
  const details = el("details", { class: "table-view" });
  details.appendChild(el("summary", {}, "View data as a table"));
  const table = el("table");
  const head = el("tr");
  for (const c of columns) head.appendChild(el("th", { scope: "col" }, c));
  table.appendChild(el("thead")).appendChild(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const cell of row) tr.appendChild(el("td", {}, String(cell)));
    body.appendChild(tr);
  }
  table.appendChild(body);
  details.appendChild(el("div", { class: "table-scroll" })).appendChild(table);
  return details;
}
