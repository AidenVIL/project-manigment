import { escapeHtml, formatDate, formatRelativeCountdown } from "../../utils/formatters.js";

export function renderCalendarView({ events, summary }) {
  const eventMarkup = events.length
    ? events
        .map(
          (event) => `
            <article class="timeline-card panel timeline-card--${event.tone}">
              <div class="timeline-day">
                <span>${formatDate(event.date)}</span>
                <strong>${escapeHtml(formatRelativeCountdown(event.daysAway))}</strong>
              </div>
              <div class="timeline-content">
                <span class="badge badge--outline">${escapeHtml(event.type)}</span>
                <h3>${escapeHtml(event.companyName)}</h3>
                <p>${escapeHtml(event.description)}</p>
              </div>
            </article>
          `
        )
        .join("")
    : `
      <div class="panel empty-state">
        <h3>No milestone dates yet</h3>
        <p>Add follow-up, proposal, or interview dates to companies and they will appear here.</p>
      </div>
    `;

  return `
    <section id="calendar" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Action Calendar</span>
          <h2>Follow-Ups & Milestones</h2>
        </div>
      </div>
      <div class="stats-grid stats-grid--compact">
        <article class="stat-card panel">
          <span>Overdue</span>
          <strong>${summary.overdue}</strong>
        </article>
        <article class="stat-card panel">
          <span>Next 7 Days</span>
          <strong>${summary.nextSevenDays}</strong>
        </article>
        <article class="stat-card panel">
          <span>Proposals</span>
          <strong>${summary.proposals}</strong>
        </article>
        <article class="stat-card panel">
          <span>Interviews</span>
          <strong>${summary.interviews}</strong>
        </article>
      </div>
      <div class="timeline-grid">${eventMarkup}</div>
    </section>
  `;
}
