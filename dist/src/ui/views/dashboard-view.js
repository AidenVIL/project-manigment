import { renderDonutChart, renderProgressBars } from "../components/charts.js";
import { formatCompactCurrency, formatCurrency, escapeHtml } from "../../utils/formatters.js";

export function renderDashboardView({ config, snapshot }) {
  const topBackers = snapshot.topBackers.length
    ? snapshot.topBackers
        .map(
          (company) => `
            <div class="backer-row">
              <span>${escapeHtml(company.companyName)}</span>
              <strong>${formatCompactCurrency(company.contributionValue)}</strong>
            </div>
          `
        )
        .join("")
    : `<div class="empty-inline">No confirmed backers yet.</div>`;

  const legend = snapshot.contributionSegments
    .map(
      (segment) => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${segment.color}"></span>
          <span>${escapeHtml(segment.label)}</span>
          <strong>${formatCompactCurrency(segment.value)}</strong>
        </div>
      `
    )
    .join("");

  return `
    <section id="overview" class="hero-panel panel">
      <div class="hero-copy">
        <span class="eyebrow">Atomic Partner Grid</span>
        <h1>${escapeHtml(config.teamName)}</h1>
        <p>
          Run sponsor outreach, follow-up dates, email templates, and contribution tracking from
          one place built around the Atomic identity.
        </p>
        <div class="hero-actions">
          <button type="button" class="primary-button" data-action="open-add-company">Add Company</button>
          <a href="#emails" class="ghost-link">Open Email Studio</a>
        </div>
      </div>
      <div class="hero-art">
        <img src="${escapeHtml(config.logoPath)}" alt="${escapeHtml(config.teamName)} logo" />
      </div>
      <div class="hero-callout">
        <span class="eyebrow">Season Goal</span>
        <strong>${formatCurrency(config.fundraisingTarget)}</strong>
        <p>${escapeHtml(config.seasonLabel)}</p>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card panel">
        <span>Total Raised</span>
        <strong>${formatCurrency(snapshot.totalRaised)}</strong>
        <small>${Math.round(snapshot.progress * 100)}% of target</small>
      </article>
      <article class="stat-card panel">
        <span>Open Pipeline</span>
        <strong>${formatCurrency(snapshot.totalAsked)}</strong>
        <small>${snapshot.warmPipelineCount} active conversations</small>
      </article>
      <article class="stat-card panel">
        <span>Secured Partners</span>
        <strong>${snapshot.securedCount}</strong>
        <small>Confirmed contributors</small>
      </article>
      <article class="stat-card panel">
        <span>Overdue Follow-Ups</span>
        <strong>${snapshot.overdueFollowUps}</strong>
        <small>Needs team attention</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel chart-panel">
        <div class="section-header">
          <div>
            <span class="eyebrow">Contribution Split</span>
            <h2>Raised vs Target</h2>
          </div>
        </div>
        ${renderDonutChart(
          snapshot.contributionSegments,
          snapshot.totalRaised,
          config.fundraisingTarget
        )}
        <div class="legend-list">${legend}</div>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <span class="eyebrow">Pipeline Shape</span>
            <h2>Status Breakdown</h2>
          </div>
        </div>
        ${renderProgressBars(snapshot.statusBreakdown)}
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <span class="eyebrow">Priority Backers</span>
            <h2>Top Confirmed Support</h2>
          </div>
        </div>
        <div class="backer-list">${topBackers}</div>
      </article>
    </section>
  `;
}
