import {
  askTypeOptions,
  companyStatusOptions,
  getOptionLabel,
  responseStatusOptions
} from "../../models/company-model.js";
import { daysUntil } from "../../utils/date-utils.js";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatRelativeCountdown,
  getInitials
} from "../../utils/formatters.js";

function getToneClass(status) {
  const tones = {
    prospect: "muted",
    warm: "warning",
    proposal: "accent",
    negotiating: "success",
    secured: "success",
    closed: "danger"
  };

  return tones[status] || "muted";
}

function getOutreachState(company) {
  if (!company.firstContacted) {
    return {
      tone: "danger",
      cardTone: "uncontacted",
      label: "No Email Sent"
    };
  }

  if (company.responseStatus === "won" || company.status === "secured") {
    return {
      tone: "success",
      cardTone: "confirmed",
      label: "Support Confirmed"
    };
  }

  if (
    ["interested", "requested_info", "interview"].includes(company.responseStatus) ||
    ["warm", "proposal", "negotiating"].includes(company.status)
  ) {
    return {
      tone: "info",
      cardTone: "active",
      label: "Engaged"
    };
  }

  if (company.responseStatus === "declined" || company.status === "closed") {
    return {
      tone: "muted",
      cardTone: "closed",
      label: "Closed Out"
    };
  }

  return {
    tone: "warning",
    cardTone: "contacted",
    label: "Contacted"
  };
}

export function renderCompaniesView({ filters, companies, totalCompanies }) {
  const statusOptions = [
    { value: "all", label: "All statuses" },
    ...companyStatusOptions
  ];
  const responseOptions = [
    { value: "all", label: "All response states" },
    ...responseStatusOptions
  ];
  const askOptions = [
    { value: "all", label: "All ask types" },
    ...askTypeOptions
  ];
  const sortOptions = [
    { value: "updated_desc", label: "Recently updated" },
    { value: "alpha_asc", label: "A-Z company" },
    { value: "alpha_desc", label: "Z-A company" },
    { value: "next_follow_up", label: "Next follow-up date" },
    { value: "ask_desc", label: "Highest ask value" },
    { value: "confirmed_desc", label: "Highest confirmed value" }
  ];

  const companyCards = companies.length
    ? companies
        .map((company) => {
          const followUpDays = daysUntil(company.nextFollowUp);
          const outreachState = getOutreachState(company);

          return `
            <article class="company-card company-card--${outreachState.cardTone} panel">
              <div class="company-card-top">
                <div class="company-avatar">${escapeHtml(getInitials(company.companyName))}</div>
                <div>
                  <h3>${escapeHtml(company.companyName)}</h3>
                  <p>${escapeHtml(company.contactName || "Primary contact not set")}</p>
                  <p>${escapeHtml(`${(company.contacts || []).length} saved contact${(company.contacts || []).length === 1 ? "" : "s"}`)}</p>
                  ${
                    company.website
                      ? `<p><a href="${escapeHtml(company.website)}" target="_blank" rel="noreferrer">${escapeHtml(
                          company.website
                        )}</a></p>`
                      : ""
                  }
                </div>
                <div class="company-actions">
                  <span class="badge badge--${outreachState.tone}">${escapeHtml(outreachState.label)}</span>
                  <span class="badge badge--${getToneClass(company.status)}">${escapeHtml(
                    getOptionLabel(companyStatusOptions, company.status)
                  )}</span>
                  <button type="button" class="ghost-button" data-action="edit-company" data-id="${
                    company.id
                  }">Edit</button>
                </div>
              </div>
              <div class="company-metrics">
                <div>
                  <span class="metric-label">Ask</span>
                  <strong>${formatCurrency(company.askValue)}</strong>
                  <small>${escapeHtml(getOptionLabel(askTypeOptions, company.askType))}</small>
                </div>
                <div>
                  <span class="metric-label">Confirmed</span>
                  <strong>${formatCurrency(company.contributionValue)}</strong>
                  <small>${escapeHtml(company.contributionType || "Pending")}</small>
                </div>
                <div>
                  <span class="metric-label">Next Follow-Up</span>
                  <strong>${formatDate(company.nextFollowUp)}</strong>
                  <small>${escapeHtml(formatRelativeCountdown(followUpDays))}</small>
                </div>
              </div>
              <div class="company-detail-grid">
                <div>
                  <span class="metric-label">They Want From Us</span>
                  <p>${escapeHtml(company.requestFromUs || "Not captured yet.")}</p>
                </div>
                <div>
                  <span class="metric-label">They Are Giving</span>
                  <p>${escapeHtml(company.givingInReturn || "Still being discussed.")}</p>
                </div>
              </div>
              <div class="company-footer">
                <span class="badge badge--outline">${escapeHtml(
                  getOptionLabel(responseStatusOptions, company.responseStatus)
                )}</span>
                <div class="company-footer-actions">
                  <button
                    type="button"
                    class="ghost-button"
                    data-action="focus-email-company"
                    data-id="${company.id}"
                  >
                    Use In Email Studio
                  </button>
                  <button
                    type="button"
                    class="ghost-button ghost-button--danger"
                    data-action="delete-company"
                    data-id="${company.id}"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")
    : `
      <div class="panel empty-state">
        <h3>No companies match this filter</h3>
        <p>Try widening the status filter or clearing the search.</p>
      </div>
    `;

  return `
    <section id="companies" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Company CRM</span>
          <h2>Sponsor Pipeline</h2>
        </div>
        <button type="button" class="primary-button" data-action="open-add-company">Add Company</button>
      </div>
      <div class="toolbar panel">
        <div class="toolbar-field">
          <span>Search</span>
          <input id="company-search" value="${escapeHtml(filters.search)}" placeholder="Search company or contact" />
        </div>
        <div class="toolbar-field">
          <span>Status</span>
          <select id="status-filter">
            ${statusOptions
              .map(
                (option) => `
                  <option value="${option.value}" ${filters.status === option.value ? "selected" : ""}>
                    ${option.label}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="toolbar-field">
          <span>Response</span>
          <select id="response-status-filter">
            ${responseOptions
              .map(
                (option) => `
                  <option value="${option.value}" ${filters.responseStatus === option.value ? "selected" : ""}>
                    ${option.label}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="toolbar-field">
          <span>Ask Type</span>
          <select id="ask-type-filter">
            ${askOptions
              .map(
                (option) => `
                  <option value="${option.value}" ${filters.askType === option.value ? "selected" : ""}>
                    ${option.label}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="toolbar-field">
          <span>Sort</span>
          <select id="company-sort-filter">
            ${sortOptions
              .map(
                (option) => `
                  <option value="${option.value}" ${filters.sortBy === option.value ? "selected" : ""}>
                    ${option.label}
                  </option>
                `
              )
              .join("")}
          </select>
        </div>
        <div class="toolbar-summary">
          <strong>${totalCompanies}</strong>
          <span>Total tracked companies</span>
        </div>
      </div>
      <div class="company-grid">${companyCards}</div>
    </section>
  `;
}
