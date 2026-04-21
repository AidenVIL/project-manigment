import { formatCompactCurrency } from "../../utils/formatters.js";

export function renderDonutChart(segments = [], totalRaised = 0, target = 0) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const chartTotal = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let offset = 0;

  const segmentMarkup = segments
    .map((segment) => {
      const length = (segment.value / chartTotal) * circumference;
      const markup = `<circle
        cx="110"
        cy="110"
        r="${radius}"
        fill="none"
        stroke="${segment.color}"
        stroke-width="24"
        stroke-linecap="round"
        stroke-dasharray="${length} ${circumference}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 110 110)"
      />`;

      offset += length;
      return markup;
    })
    .join("");

  return `
    <div class="chart-shell">
      <svg class="donut-chart" viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="24" />
        ${segmentMarkup}
      </svg>
      <div class="chart-center">
        <span class="chart-kicker">Raised</span>
        <strong>${formatCompactCurrency(totalRaised)}</strong>
        <span>${Math.round((target ? totalRaised / target : 0) * 100)}% of target</span>
      </div>
    </div>
  `;
}

export function renderProgressBars(items = []) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return `
    <div class="progress-stack">
      ${items
        .map(
          (item) => `
            <div class="progress-row">
              <div class="progress-meta">
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
              <div class="progress-track">
                <span class="progress-fill" style="width:${(item.value / max) * 100}%"></span>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}
