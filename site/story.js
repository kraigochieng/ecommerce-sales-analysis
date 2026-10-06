import { el, svgEl } from "./dom.js";
import { barChart, lineChart, mount, tableView } from "./charts.js";

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

// --- story building blocks -------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// parts: plain strings, or { b: "text" } for bold text.
function paragraph(className, parts) {
  const p = el("p", { class: className });
  for (const part of parts) {
    p.append(typeof part === "string" ? document.createTextNode(part) : el("strong", {}, part.b));
  }
  return p;
}

function storySection({ num, title, lede }) {
  const section = el("section", { class: "story", "aria-labelledby": `story-${num}` });
  section.appendChild(el("p", { class: "story-num" }, `Finding ${num} of 4`));
  section.appendChild(el("h2", { id: `story-${num}` }, title));
  section.appendChild(paragraph("story-lede", lede));
  return section;
}

function chartCard(title, subtitle) {
  const card = el("figure", { class: "card" });
  card.appendChild(el("p", { class: "chart-title" }, title));
  card.appendChild(el("p", { class: "chart-sub" }, subtitle));
  const host = el("div", { class: "chart-host" });
  card.appendChild(host);
  return { card, host };
}

function chips(items) {
  const row = el("div", { class: "chips" });
  for (const item of items) {
    const chip = el("div", { class: "chip" });
    chip.appendChild(el("p", { class: "chip-label" }, item.label));
    chip.appendChild(el("p", { class: "chip-value" }, item.value));
    chip.appendChild(el("p", { class: "chip-compare" }, item.compare));
    row.appendChild(chip);
  }
  return row;
}

function recommendations(items, caveat) {
  const frag = document.createDocumentFragment();
  frag.appendChild(el("p", { class: "recs-title" }, "What to do"));
  const list = el("ul", { class: "recs" });
  for (const item of items) {
    const li = el("li", item.test ? { class: "test" } : {});
    li.textContent = item.test ? `To test: ${item.text}` : item.text;
    list.appendChild(li);
  }
  frag.appendChild(list);
  if (caveat) frag.appendChild(el("p", { class: "caveat" }, caveat));
  return frag;
}

// --- finding 1: November -----------------------------------------------------

function novemberSection(monthly, drivers) {
  const novIdx = monthly.map((r, i) => (r.order_date_year_month.endsWith("-11") ? i : -1)).filter((i) => i >= 0);
  const novUp = novIdx.map((i) => monthly[i].mom_revenue_pct);
  const decDown = novIdx.map((i) => monthly[i + 1].mom_revenue_pct).map((v) => -v);
  const range = (xs) => `${Math.round(Math.min(...xs))}–${Math.round(Math.max(...xs))}%`;

  const isNov = (d) => d.order_date_year_month.endsWith("-11");
  const rest = drivers.filter((d) => !isNov(d));
  const novs = drivers.filter(isNov);
  const novUnits = mean(novs.map((d) => d.avg_quantity));
  const restUnits = mean(rest.map((d) => d.avg_quantity));

  const section = storySection({
    num: 1,
    title: "Every November, one extra unit per order lifts revenue by about 20%.",
    lede: [
      "Net revenue jumps ", { b: range(novUp) }, " from October to November, in all three years. ",
      "The cause is not more orders and not bigger discounts. Customers buy ",
      { b: `${novUnits.toFixed(1)} units per order instead of ${restUnits.toFixed(1)}` },
      ". Then revenue falls ", { b: range(decDown) }, " in December.",
    ],
  });

  const labels = monthly.map((r) => monthLabel(r.order_date_year_month));
  const xTicks = [0, 12, 24].map((i) => ({ index: i, label: labels[i].slice(4) }));

  const rev = chartCard("Net revenue by month", "Millions of dollars. The axis starts at $1.5M.");
  mount(rev.host, (host, width) => lineChart(host, width, {
    data: monthly.map((r, i) => ({
      label: labels[i],
      value: r.net_revenue / 1e6,
      tag: novIdx.includes(i) ? `+${r.mom_revenue_pct.toFixed(0)}%` : undefined,
    })),
    highlight: new Set(novIdx),
    yMin: 1.5, yMax: 2.6, yTicks: [1.5, 2.0, 2.5],
    yFormat: (v) => `$${v.toFixed(1)}M`,
    valueFormat: (v) => `$${v.toFixed(2)}M`,
    xTicks, height: 210,
    ariaLabel: "Line chart of monthly net revenue, 2023 to 2025. Revenue peaks every November.",
  }));
  section.appendChild(rev.card);

  const units = chartCard("Units per order by month", "Average quantity in each order. Highlighted: November.");
  mount(units.host, (host, width) => lineChart(host, width, {
    data: drivers.map((d, i) => ({
      label: labels[i],
      value: d.avg_quantity,
      tag: novIdx.includes(i) ? d.avg_quantity.toFixed(1) : undefined,
    })),
    highlight: new Set(novIdx),
    yMin: 2, yMax: 5, yTicks: [2, 3, 4, 5],
    yFormat: (v) => v.toFixed(0),
    valueFormat: (v) => `${v.toFixed(2)} units`,
    xTicks, height: 190,
    ariaLabel: "Line chart of average units per order by month. It sits near 3 and rises to 4 every November.",
  }));
  section.appendChild(units.card);

  const novOrders = mean(novs.map((d) => d.order_count));
  const restOrders = mean(rest.map((d) => d.order_count));
  const novDisc = mean(novs.map((d) => d.avg_discount_percent));
  const restDisc = mean(rest.map((d) => d.avg_discount_percent));
  section.appendChild(chips([
    { label: "Orders per month", value: Math.round(novOrders).toLocaleString("en-US"), compare: `November. Other months: ${Math.round(restOrders).toLocaleString("en-US")}` },
    { label: "Average discount", value: `${novDisc.toFixed(1)}%`, compare: `November. Other months: ${restDisc.toFixed(1)}%` },
    { label: "Units per order", value: novUnits.toFixed(1), compare: `November. Other months: ${restUnits.toFixed(1)}` },
  ]));

  section.appendChild(recommendations(
    [
      { text: "Offer multi-unit bundles in November. Customers already add a unit per order, so bundles make that easy to do." },
      { text: `Set December targets against the dip, not against November. Revenue fell ${range(decDown)} after every November.` },
      { text: "gift cards and express shipping in December, aimed at last-minute shoppers. The data cannot show this behavior, so run it as an experiment.", test: true },
    ],
    "Each order holds one product type, so units per order means the quantity of that product.",
  ));

  section.appendChild(tableView(
    ["Month", "Net revenue", "Orders", "Units per order", "Average discount"],
    monthly.map((r, i) => [labels[i], `$${r.net_revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, drivers[i].order_count, drivers[i].avg_quantity, `${drivers[i].avg_discount_percent}%`]),
  ));
  return section;
}

// --- finding 2: Fashion returns ----------------------------------------------

function fashionSection(byCategory, byRegionCategory) {
  const regions = [...new Set(byRegionCategory.map((r) => r.region))].sort();
  const pct = (v) => `${v.toFixed(1)}%`;

  // Order-weighted return rate of every category except Fashion.
  const othersRate = (rows) => {
    const others = rows.filter((r) => r.product_category !== "Fashion");
    const orders = others.reduce((a, r) => a + r.order_count, 0);
    return others.reduce((a, r) => a + r.return_rate * r.order_count, 0) / orders;
  };
  const fashionRate = (rows) => rows.find((r) => r.product_category === "Fashion").return_rate;

  const overallMultiple = fashionRate(byCategory) / othersRate(byCategory);
  const otherRates = byCategory.filter((r) => r.product_category !== "Fashion").map((r) => r.return_rate);
  const fashionByRegion = regions.map((reg) => fashionRate(byRegionCategory.filter((r) => r.region === reg)));

  const section = storySection({
    num: 2,
    title: `Fashion orders come back ${overallMultiple.toFixed(1)} times as often as any other category.`,
    lede: [
      { b: `${pct(fashionRate(byCategory))} of Fashion orders are returned.` },
      ` Every other category sits between ${pct(Math.min(...otherRates))} and ${pct(Math.max(...otherRates))}. `,
      `The gap holds in every region (Fashion: ${pct(Math.min(...fashionByRegion))} to ${pct(Math.max(...fashionByRegion))}), `,
      "so this is a product problem, not a regional one.",
    ],
  });

  const filters = el("div", { class: "filters" });
  const selectId = "fashion-region";
  filters.appendChild(el("label", { for: selectId }, "Region"));
  const select = el("select", { id: selectId });
  for (const name of ["All regions", ...regions]) select.appendChild(el("option", { value: name }, name));
  filters.appendChild(select);
  section.appendChild(filters);

  const chart = chartCard("Return rate by product category", "Share of orders returned. Fashion is highlighted.");
  const note = el("p", { class: "filter-note", "aria-live": "polite" });
  chart.card.appendChild(note);
  const tableSlot = el("div");

  let rows = byCategory;
  const view = mount(chart.host, (host, width) => barChart(host, width, {
    data: [...rows].sort((a, b) => b.return_rate - a.return_rate).map((r) => ({
      label: r.product_category,
      value: r.return_rate,
      highlight: r.product_category === "Fashion",
      detail: `${r.order_count.toLocaleString("en-US")} orders`,
    })),
    max: 15,
    format: pct,
    refLine: { value: othersRate(rows), label: `Other categories: ${pct(othersRate(rows))}` },
    ariaLabel: "Bar chart of return rate by product category. Fashion is about 12 percent. The others are about 5 percent.",
  }));

  const update = () => {
    const region = select.value;
    rows = region === "All regions" ? byCategory : byRegionCategory.filter((r) => r.region === region);
    const f = fashionRate(rows), o = othersRate(rows);
    note.textContent = `${region}: Fashion ${pct(f)}, other categories ${pct(o)}. Fashion returns ${(f / o).toFixed(1)} times as often.`;
    view.redraw();
    tableSlot.replaceChildren(tableView(
      ["Category", "Return rate", "Orders"],
      [...rows].sort((a, b) => b.return_rate - a.return_rate).map((r) => [r.product_category, pct(r.return_rate), r.order_count.toLocaleString("en-US")]),
    ));
  };
  select.addEventListener("change", update);
  update();

  section.appendChild(chart.card);
  section.appendChild(recommendations(
    [
      { text: "Add size guidance to Fashion listings: a sizing tool or \"true to fit\" reviews." },
      { text: "Show fabric close-ups and clear photos, so the product matches what customers expect." },
      { text: "a return-reason question at checkout for Fashion. Today nothing records why items come back.", test: true },
    ],
    "The data holds no return reasons. These actions target likely causes, not proven ones.",
  ));
  section.appendChild(tableSlot);
  return section;
}

// --- boot ------------------------------------------------------------------

async function main() {
  initThemeToggle();
  try {
    const [yearly, monthly, drivers, byCategory, byRegionCategory] = await Promise.all([
      loadJson("yearly_kpis"), loadJson("monthly_kpis"), loadJson("monthly_drivers"),
      loadJson("return_rate_by_category"), loadJson("return_rate_by_category_region"),
    ]);
    renderKpis(yearly, monthly);
    const story = document.getElementById("story");
    story.appendChild(novemberSection(monthly, drivers));
    story.appendChild(fashionSection(byCategory, byRegionCategory));
  } catch (err) {
    const box = el("div", { class: "error" }, `The data did not load. ${err.message}`);
    document.getElementById("kpi-strip").replaceWith(box);
  }
}

main();
