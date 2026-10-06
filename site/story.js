import { el, svgEl } from "./dom.js";

const FLAT_THRESHOLD_PCT = 1;

// --- helpers ---------------------------------------------------------------

async function loadJson(name) {
  const res = await fetch(`data/${name}.json`);
  if (!res.ok) throw new Error(`Could not load ${name}.json (${res.status})`);
  return res.json();
}

const pctChange = (now, before) => ((now - before) / before) * 100;

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

// --- theme toggle ----------------------------------------------------------

function initThemeToggle() {
  const root = document.documentElement;
  const button = document.getElementById("theme-toggle");
  try {
    const saved = localStorage.getItem("theme");
    if (saved) root.dataset.theme = saved;
  } catch (_) { /* storage can be blocked; the page works without it */ }

  button.addEventListener("click", () => {
    const isDark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) { /* ignore */ }
  });
}

// --- KPI strip -------------------------------------------------------------

const SPARK = { w: 160, h: 40, pad: 4, minRelativeRange: 0.12 };

// Vertical position (0 at top, 1 at bottom) of each value. The range is never
// narrower than 12% of the mean, so rounding noise does not look like a trend.
function sparkScale(values) {
  const min = Math.min(...values), max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const mid = (min + max) / 2;
  const half = Math.max((max - min) / 2, (Math.abs(mean) * SPARK.minRelativeRange) / 2) || 1;
  return (v) => 1 - (v - (mid - half)) / (2 * half);
}

function sparkline(values) {
  const { w, h, pad } = SPARK;
  const scale = sparkScale(values);
  const x = (i) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v) => pad + scale(v) * (h - 2 * pad);

  const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  svg.appendChild(svgEl("polyline", {
    points: values.map((v, i) => `${x(i)},${y(v)}`).join(" "),
    fill: "none",
    stroke: "var(--muted-mark)",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "vector-effect": "non-scaling-stroke",
  }));
  return svg;
}

// The end dot is an HTML element so it stays round when the SVG stretches.
function endDot(values) {
  const { h, pad } = SPARK;
  const top = pad + sparkScale(values)(values[values.length - 1]) * (h - 2 * pad);
  const dot = el("span", { class: "spark-dot", "aria-hidden": "true" });
  dot.style.top = `${(top / h) * 100}%`;
  return dot;
}

function kpiTile({ label, value, delta, upIsGood, series, compareYear }) {
  const tile = el("div", { class: "kpi", role: "listitem" });
  tile.appendChild(el("p", { class: "kpi-label" }, label));
  tile.appendChild(el("p", { class: "kpi-value" }, value));

  let text, cls = "";
  if (Math.abs(delta) < FLAT_THRESHOLD_PCT) {
    text = `● Flat vs ${compareYear}`;
  } else {
    const up = delta > 0;
    text = `${up ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% vs ${compareYear}`;
    cls = up === upIsGood ? "good" : "bad";
  }
  tile.appendChild(el("p", { class: `kpi-delta ${cls}`.trim() }, text));

  const frame = el("div", { class: "spark" });
  frame.appendChild(sparkline(series));
  frame.appendChild(endDot(series));
  tile.appendChild(frame);
  return tile;
}

function renderKpis(yearly, monthly) {
  const now = yearly[yearly.length - 1];
  const before = yearly[yearly.length - 2];
  const last12 = monthly.slice(-12);
  const col = (key) => last12.map((r) => r[key]);

  document.getElementById("kpi-compare").textContent = `· vs ${before.year}`;

  const tiles = [
    { label: "Net revenue", value: `$${compact(now.net_revenue)}`, key: "net_revenue", field: "net_revenue", upIsGood: true },
    { label: "Average order value", value: `$${now.aov.toFixed(0)}`, key: "aov", field: "aov", upIsGood: true },
    { label: "Return rate", value: `${now.return_rate.toFixed(1)}%`, key: "return_rate", field: "return_rate", upIsGood: false },
    { label: "Delivery time", value: `${now.avg_delivery_days.toFixed(1)} days`, key: "avg_delivery_days", field: "avg_delivery_days", upIsGood: false },
    { label: "Customer rating", value: `${now.csat.toFixed(1)} / 5`, key: "csat", field: "csat", upIsGood: true },
  ];

  const strip = document.getElementById("kpi-strip");
  for (const t of tiles) {
    strip.appendChild(kpiTile({
      label: t.label,
      value: t.value,
      delta: pctChange(now[t.field], before[t.field]),
      upIsGood: t.upIsGood,
      series: col(t.key),
      compareYear: before.year,
    }));
  }
}

// --- boot ------------------------------------------------------------------

async function main() {
  initThemeToggle();
  try {
    const [yearly, monthly] = await Promise.all([loadJson("yearly_kpis"), loadJson("monthly_kpis")]);
    renderKpis(yearly, monthly);
  } catch (err) {
    const box = el("div", { class: "error" }, `The data did not load. ${err.message}`);
    document.getElementById("kpi-strip").replaceWith(box);
  }
}

main();
