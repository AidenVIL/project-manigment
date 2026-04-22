import { escapeHtml, formatDate, formatRelativeCountdown } from "../../utils/formatters.js";

function renderMonthCalendar(calendarMonth) {
  const grid = calendarMonth.weeks
    .map(
      (week) => `
        <div class="month-calendar__week">
          ${week
            .map(
              (day) => `
                <article class="month-calendar__day ${day.isCurrentMonth ? "" : "is-muted"} ${day.isToday ? "is-today" : ""}">
                  <div class="month-calendar__day-head">
                    <strong>${day.dayNumber}</strong>
                    ${day.events.length ? `<span>${day.events.length} event${day.events.length === 1 ? "" : "s"}</span>` : ""}
                  </div>
                  <div class="month-calendar__events">
                    ${day.events
                      .slice(0, 2)
                      .map(
                        (event) => `
                          <button
                            type="button"
                            class="month-calendar__event-pill month-calendar__event-pill--${event.tone}"
                            data-action="open-follow-up-workflow"
                            data-id="${event.id}"
                          >
                            ${escapeHtml(event.type)} · ${escapeHtml(event.companyName)}
                          </button>
                        `
                      )
                      .join("")}
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");

  const agendaMarkup = calendarMonth.agenda.length
    ? calendarMonth.agenda
        .map(
          (event) => `
            <article class="month-agenda__item">
              <div>
                <span class="badge badge--outline">${escapeHtml(event.type)}</span>
                <h3>${escapeHtml(event.companyName)}</h3>
                <p>${escapeHtml(event.description)}</p>
              </div>
              <div class="month-agenda__meta">
                <strong>${formatDate(event.date)}</strong>
                <small>${escapeHtml(formatRelativeCountdown(event.daysAway))}</small>
              </div>
              <button
                type="button"
                class="ghost-button month-agenda__button"
                data-action="open-follow-up-workflow"
                data-id="${event.id}"
              >
                Use This Follow-Up
              </button>
            </article>
          `
        )
        .join("")
    : `
      <div class="empty-state">
        <h3>No events this month</h3>
        <p>Tick proposal or interview dates on companies and they will land here.</p>
      </div>
    `;

  return `
    <div class="month-calendar panel">
      <div class="month-calendar__header">
        <div>
          <span class="eyebrow">Monthly Calendar</span>
          <h3>${escapeHtml(calendarMonth.monthLabel)}</h3>
        </div>
        <div class="month-calendar__nav">
          <button type="button" class="ghost-button" data-action="calendar-month-prev">Previous</button>
          <button type="button" class="ghost-button" data-action="calendar-month-today">This Month</button>
          <button type="button" class="ghost-button" data-action="calendar-month-next">Next</button>
        </div>
      </div>
      <div class="month-calendar__labels">
        ${calendarMonth.dayLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="month-calendar__grid">${grid}</div>
      <div class="month-agenda">
        <div class="editor-section-label">
          <span class="eyebrow">This Month</span>
          <p>Everything due this month, listed underneath the calendar.</p>
        </div>
        <div class="month-agenda__list">${agendaMarkup}</div>
      </div>
    </div>
  `;
}

export function renderCalendarView({ events, summary, calendarMonth }) {
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
              <button
                type="button"
                class="ghost-button"
                data-action="open-follow-up-workflow"
                data-id="${event.id}"
              >
                Start Follow-Up
              </button>
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
      ${renderMonthCalendar(calendarMonth)}
    </section>
  `;
}
