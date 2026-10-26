"use strict";

// The browser receives aggregate counts only. All record-level work is in Python.
const number = new Intl.NumberFormat("en-GB");
const formats = ["physical", "digital"];
const names = { physical: "Physical", digital: "Digital" };
let data;
let percentageAxisMaximum;

function count(value) {
  return number.format(value);
}

function percent(value) {
  return `${value.toFixed(2)}%`;
}

function text(id, value) {
  document.getElementById(id).textContent = value;
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function titleCase(label) {
  return label[0].toUpperCase() + label.slice(1);
}

function renderCategories() {
  const chart = document.getElementById("category-chart");
  for (const category of data.categories.items) {
    const row = element("div", "category-row");
    row.setAttribute("role", "listitem");
    row.setAttribute("aria-label", `${category.label}: ${count(category.count)} tickets, ${percent(category.percentage)} of digital tickets`);
    row.append(element("span", "category-label", titleCase(category.label)));
    const track = element("div", "category-track");
    track.setAttribute("aria-hidden", "true");
    const bar = element("div", "category-bar");
    bar.style.width = `${category.percentage}%`;
    track.append(bar);
    const value = element("div", "category-value", count(category.count));
    value.append(element("span", "", percent(category.percentage)));
    row.append(track, value);
    chart.append(row);
  }
  text("category-denominator", `Denominator: ${count(data.categories.total_tickets)} recorded digital tickets. Bars use a 0–100% scale.`);
  const solo = data.categories.items.find(category => category.label === "solo live");
  text("solo-share", percent(solo.percentage));
  text("solo-description", `${count(solo.count)} of ${count(data.categories.total_tickets)} digital tickets are labelled ‘solo live’.`);
}

function svgElement(tag, attributes = {}, content) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  return node;
}

function calculatePercentageAxisMaximum() {
  let largestBinPercentage = 0;
  // Include both formats and both cancellation states so filtering never rescales the charts.
  for (const cancellationState of ["include_cancelled", "exclude_cancelled"]) {
    for (const format of formats) {
      const statistics = data.timing[cancellationState][format];
      if (statistics.record_count === 0) continue;
      for (const binCount of statistics.histogram) {
        const binPercentage = binCount / statistics.record_count * 100;
        largestBinPercentage = Math.max(largestBinPercentage, binPercentage);
      }
    }
  }
  // Round up to five percentage points, using one shared limit for the two charts.
  return Math.max(5, Math.ceil(largestBinPercentage / 5) * 5);
}

function drawHistogram(format, statistics, displayMode) {
  const edges = data.timing.bin_edges;
  const percentageMode = displayMode === "percentage";
  const maximum = percentageMode ? percentageAxisMaximum : data.timing.y_max;
  const axisLabel = percentageMode ? "Percentage within format" : "Record count";
  const axisRange = percentageMode ? `0 to ${maximum}% within this format` : `0 to ${count(maximum)} records`;
  const container = document.getElementById(`${format}-histogram`);
  // Match the SVG coordinate width to its displayed width, keeping text legible.
  const chartWidth = container.clientWidth;
  const compact = chartWidth < 400;
  const left = 49;
  const top = 38;
  const width = chartWidth - left - 14;
  const height = 190;
  const bottom = top + height;
  const x = value => left + (value - edges[0]) / (edges[edges.length - 1] - edges[0]) * width;
  const y = value => bottom - value / maximum * height;
  const svg = svgElement("svg", { viewBox: `0 0 ${chartWidth} 300`, role: "img", "aria-labelledby": `${format}-chart-title ${format}-chart-desc` });
  svg.append(svgElement("title", { id: `${format}-chart-title` }, `${names[format]} recorded transaction timing histogram`));
  svg.append(svgElement("desc", { id: `${format}-chart-desc` }, `${count(statistics.record_count)} positive-quantity order–event records. Median ${statistics.median_days.toFixed(2)} days before start. ${percent(statistics.after_start_percentage)} recorded after start. Bar heights: ${axisLabel.toLowerCase()}. Shared axes: ${edges[0]} to ${edges.at(-1)} days and ${axisRange}. Exact bin counts are available in the table below.`));

  if (format === "digital") {
    const defs = svgElement("defs");
    const pattern = svgElement("pattern", { id: "digital-hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pattern.append(svgElement("rect", { width: 7, height: 7, fill: "#a94f29" }));
    pattern.append(svgElement("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#e1ab91", "stroke-width": 2 }));
    defs.append(pattern);
    svg.append(defs);
  }

  svg.append(svgElement("text", { x: left, y: 15, "font-size": 12 }, axisLabel));
  for (let step = 0; step <= 4; step += 1) {
    const value = maximum * step / 4;
    svg.append(svgElement("line", { x1: left, x2: left + width, y1: y(value), y2: y(value), stroke: "#dfe5de", "stroke-width": 1 }));
    const tickLabel = percentageMode ? `${value.toFixed(1)}%` : count(value);
    svg.append(svgElement("text", { x: left - 9, y: y(value) + 4, "text-anchor": "end", "font-size": 12 }, tickLabel));
  }
  for (let index = 0; index < statistics.histogram.length; index += 1) {
    const binCount = statistics.histogram[index];
    // Each record has equal weight. Divide by this format's eligible records
    // in the selected cancellation state, not by tickets or both formats combined.
    const binPercentage = binCount / statistics.record_count * 100;
    const value = percentageMode ? binPercentage : binCount;
    const bar = svgElement("rect", {
      x: x(edges[index]) + 1,
      y: y(value),
      width: x(edges[index + 1]) - x(edges[index]) - 2,
      height: bottom - y(value),
      fill: format === "physical" ? "#286459" : "url(#digital-hatch)"
    });
    const barLabel = percentageMode
      ? `${percent(binPercentage)} (${count(binCount)} of ${count(statistics.record_count)} eligible ${names[format].toLowerCase()} records)`
      : `${count(binCount)} records`;
    bar.append(svgElement("title", {}, `${edges[index]} to ${edges[index + 1]} days: ${barLabel}`));
    svg.append(bar);
  }

  // Zero marks the scheduled start; negative intervals remain in the chart.
  svg.append(svgElement("line", { x1: x(0), x2: x(0), y1: top - 8, y2: bottom, stroke: "#18343a", "stroke-dasharray": "4 4", "stroke-width": 1.2 }));
  svg.append(svgElement("text", { x: x(0) + 6, y: 28, "font-size": 11 }, "Scheduled start"));
  const tickStep = compact ? 60 : 30;
  for (let value = Math.ceil(edges[0] / tickStep) * tickStep; value <= edges.at(-1); value += tickStep) {
    svg.append(svgElement("line", { x1: x(value), x2: x(value), y1: bottom, y2: bottom + 4, stroke: "#71817c" }));
    svg.append(svgElement("text", { x: x(value), y: bottom + 21, "text-anchor": "middle", "font-size": 12 }, value));
  }
  svg.append(svgElement("text", { x: left + width / 2, y: 276, "text-anchor": "middle", "font-size": 12 }, "Days before scheduled start"));
  svg.append(svgElement("text", { x: left + width / 2, y: 293, "text-anchor": "middle", "font-size": 11 }, "Negative = recorded after start"));
  container.replaceChildren(svg);
}

function renderTiming() {
  const excluded = document.getElementById("exclude-cancelled").checked;
  const displayMode = document.getElementById("timing-mode").value;
  const cohort = excluded ? data.timing.exclude_cancelled : data.timing.include_cancelled;
  text("timing-filter-label", excluded ? "Cancelled records excluded · timing only" : "Cancelled records included · Part 2 baseline");
  for (const format of formats) {
    const statistics = cohort[format];
    text(`${format}-sample`, `n = ${count(statistics.record_count)} records`);
    const median = element("div", "stat");
    const medianValue = element("strong", "", statistics.median_days.toFixed(2));
    medianValue.append(element("small", "", "days"));
    median.append(medianValue, element("span", "", "median before scheduled start"));
    const after = element("div", "stat");
    after.append(element("strong", "", percent(statistics.after_start_percentage)), element("span", "", `${count(statistics.after_start_count)} of ${count(statistics.record_count)} records after start`));
    document.getElementById(`${format}-stats`).replaceChildren(median, after);
    drawHistogram(format, statistics, displayMode);
  }
  const scaleCaption = "Both histograms keep the same 10-day bins and horizontal range. Each mode uses one shared vertical scale that stays fixed when the cancellation filter changes.";
  const heightCaption = displayMode === "percentage"
    ? `Bar heights show bin count ÷ eligible records within that format × 100. Denominators: Physical ${count(cohort.physical.record_count)}; Digital ${count(cohort.digital.record_count)}. Each record has equal weight; percentages within each format sum to 100% before rounding.`
    : "Bar heights show the number of eligible order–event records in each bin.";
  text("timing-caption", `${heightCaption} ${scaleCaption} The table always shows exact record counts.`);
  const table = document.getElementById("histogram-table");
  table.querySelector("caption").textContent = `Exact record counts by timing interval · Cancelled records ${excluded ? "excluded" : "included"}`;
  const body = table.querySelector("tbody");
  body.replaceChildren();
  const edges = data.timing.bin_edges;
  for (let index = 0; index < edges.length - 1; index += 1) {
    const row = element("tr");
    row.append(element("td", "", `${edges[index]} to ${edges[index + 1]}`));
    for (const format of formats) row.append(element("td", "", count(cohort[format].histogram[index])));
    body.append(row);
  }
}

function renderLocations() {
  const chart = document.getElementById("location-chart");
  for (const format of formats) text(`${format}-denominator`, `${count(data.locations[format].identified_purchasers)} identified purchasers`);
  for (const [key, label] of [["uk", "United Kingdom"], ["other", "Other recorded location"], ["unknown", "Unknown"]]) {
    const row = element("div", "location-row");
    row.setAttribute("role", "listitem");
    row.append(element("span", "location-label", label));
    for (const format of formats) {
      const location = data.locations[format];
      const share = location[key] / location.identified_purchasers * 100;
      const cell = element("div");
      cell.setAttribute("aria-label", `${names[format]}, ${label}: ${count(location[key])} of ${count(location.identified_purchasers)} identified purchasers, ${percent(share)}`);
      const value = element("div", "location-value");
      value.append(element("strong", "", count(location[key])), element("span", "", percent(share)));
      const track = element("div", "location-track");
      track.setAttribute("aria-hidden", "true");
      const bar = element("div", `location-bar ${format}`);
      bar.style.width = `${share}%`;
      track.append(bar);
      cell.append(value, track);
      row.append(cell);
    }
    chart.append(row);
  }
  text("location-overlap", `All bars use a 0–100% scale. ${count(data.locations.overlap_purchasers)} accounts appear in both formats; format totals cannot be added to count unique purchasers. ‘Other recorded location’ means a known country label outside the UK.`);
}

function renderScenario(format) {
  const slider = document.getElementById(`${format}-assumption`);
  const assumption = Number(slider.value);
  const location = data.locations[format];
  const hypothetical = (location.other + assumption / 100 * location.unknown) / location.identified_purchasers * 100;
  text(`${format}-assumption-value`, `${assumption}%`);
  slider.setAttribute("aria-valuetext", `${assumption}% of unknown-country purchasers assumed outside the UK`);
  text(`${format}-scenario-share`, percent(hypothetical));
  text(`${format}-scenario-basis`, `${count(location.other)} known non-UK + ${assumption}% of ${count(location.unknown)} unknown; denominator stays ${count(location.identified_purchasers)} identified purchasers.`);
}

function renderNotes() {
  const q = data.quality;
  text("quantity-note", `All ${count(q.ticket_rows)} ticket rows are retained, including ${count(q.repeated_ticket_rows)} repetitions of earlier rows. No unique ticket ID establishes accidental duplication. The transaction file retains ${count(q.negative_quantity_rows)} negative-quantity records; these are excluded from timing.`);
  text("linkage-note", `Ticket rows join to transactions on order ID + event ID, then to customer profiles on customer ID. Validated joins preserve ${count(q.linked_ticket_rows)} rows. Gaps: ${count(q.unmatched_transaction_ticket_rows)} without a transaction, ${count(q.missing_customer_id_ticket_rows)} matched to a transaction without a purchaser ID, and ${count(q.missing_profile_ticket_rows)} with an ID but no profile. Another ${count(q.blank_country_ticket_rows)} rows match profiles with blank countries.`);
  text("format-note", `Formats and ticket categories are preserved as recorded. DIGITAL_CATCHUP includes live categories, while ${count(q.physical_online_label_ticket_rows)} physical-format ticket rows have ‘Online event:’ labels. These classifications are not corrected by guessing.`);

  const source = document.getElementById("source-notes");
  const list = element("ul");
  for (const file of data.meta.source_files) list.append(element("li", "", `${file.name} — ${count(file.rows)} source rows`));
  source.append(list);
  source.append(element("p", "", `Recorded transaction dates: ${data.meta.transaction_date_range[0].slice(0, 10)} to ${data.meta.transaction_date_range[1].slice(0, 10)}. Scheduled event dates: ${data.meta.event_date_range[0].slice(0, 10)} to ${data.meta.event_date_range[1].slice(0, 10)}. Source timestamps have no timezone information and are compared as supplied.`));
  for (const format of formats) {
    const totals = q.totals[format];
    source.append(element("p", "", `${names[format]}: ${count(totals.ticket_quantity)} ticket-file quantity; ${count(totals.positive_transaction_quantity)} positive transaction quantity and ${count(totals.negative_transaction_quantity)} negative transaction quantity give a signed total of ${count(totals.signed_transaction_quantity)}.`));
  }
  source.append(element("p", "", `${count(q.quantity_mismatch_order_event_pairs)} matched order–event pairs have different quantities across the extracts. Extraction and adjustment rules are unconfirmed, so the totals remain separate. A status of ‘Cancelled’ is used exactly as recorded. The children's programme extract is not used in this version.`));
  source.append(element("p", "", "The observed countries support recorded non-UK purchasing activity. Missing-country patterns can differ by format, so the full groups cannot be ranked confidently by international share. Country records do not establish nationality, travel or attendance."));
}

async function initialise() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Aggregate data request failed (${response.status}).`);
    data = await response.json();
    if (data.schema_version !== 1) throw new Error("The aggregate data version is unsupported.");
    percentageAxisMaximum = calculatePercentageAxisMaximum();
    // Reveal the layout before measuring chart widths.
    document.getElementById("dashboard").hidden = false;
    renderCategories();
    renderTiming();
    renderLocations();
    renderNotes();
    for (const format of formats) {
      renderScenario(format);
      document.getElementById(`${format}-assumption`).addEventListener("input", () => renderScenario(format));
    }
    document.getElementById("exclude-cancelled").addEventListener("change", renderTiming);
    document.getElementById("timing-mode").addEventListener("change", renderTiming);
    window.addEventListener("resize", renderTiming);
    document.getElementById("reset-scenarios").addEventListener("click", () => {
      for (const format of formats) {
        document.getElementById(`${format}-assumption`).value = 0;
        renderScenario(format);
      }
    });
    document.getElementById("load-status").hidden = true;
  } catch (error) {
    document.getElementById("dashboard").hidden = true;
    const status = document.getElementById("load-status");
    status.classList.add("error");
    status.setAttribute("role", "alert");
    status.textContent = `The dashboard could not load its data. Please reload the page or check the repository README for local setup. ${error.message}`;
  }
}

initialise();
