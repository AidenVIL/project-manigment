import {
  askTypeOptions,
  companyStatusOptions,
  responseStatusOptions
} from "../../models/company-model.js";
import { addDaysToInputDate, toInputDate } from "../../utils/date-utils.js";
import { escapeHtml } from "../../utils/formatters.js";

function renderOptions(options, selectedValue) {
  return options
    .map(
      (option) => `
        <option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>
          ${option.label}
        </option>
      `
    )
    .join("");
}

function renderResearchContacts(contacts = []) {
  if (!contacts.length) {
    return `<p class="research-empty">No clear named contact was found on the public pages scanned.</p>`;
  }

  return `
    <div class="research-chip-list">
      ${contacts
        .map(
          (contact, index) => `
            <button
              type="button"
              class="ghost-button ghost-button--compact"
              data-action="apply-research-contact"
              data-id="${index}"
            >
              ${escapeHtml(contact.name || "Unknown")} ${contact.role ? `| ${escapeHtml(contact.role)}` : ""}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderResearchEmails(emails = []) {
  if (!emails.length) {
    return `<p class="research-empty">No public email addresses were found on the pages scanned.</p>`;
  }

  return `
    <div class="research-chip-list">
      ${emails
        .map(
          (email, index) => `
            <button
              type="button"
              class="ghost-button ghost-button--compact"
              data-action="apply-research-email"
              data-id="${index}"
            >
              ${escapeHtml(email.email || "")}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderResearchCandidateList(candidates = [], action, buttonLabel = "Select") {
  if (!candidates.length) {
    return `<p class="research-empty">No public emails found yet. Try another company name or website.</p>`;
  }

  return `
    <div class="finder-list">
      ${candidates
        .map(
          (candidate) => `
            <article class="finder-item">
              <div class="finder-item__meta">
                <strong>${escapeHtml(candidate.email || "No email")}</strong>
                <span>${escapeHtml(candidate.areaLabel || "Public page")}</span>
                ${
                  candidate.contactName || candidate.contactRole
                    ? `<small>${escapeHtml(
                        [candidate.contactName, candidate.contactRole].filter(Boolean).join(" | ")
                      )}</small>`
                    : ""
                }
                ${candidate.matchReason ? `<small>${escapeHtml(candidate.matchReason)}</small>` : ""}
              </div>
              <button
                type="button"
                class="primary-button primary-button--compact"
                data-action="${action}"
                data-id="${escapeHtml(candidate.id)}"
              >
                ${escapeHtml(buttonLabel)}
              </button>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCompanyCandidateList(candidates = [], selectedId = "", action = "preview-company-candidate", buttonLabel = "View") {
  if (!candidates.length) {
    return `<p class="research-empty">No likely company matches yet. Try another name or add a more specific context.</p>`;
  }

  return `
    <div class="finder-list">
      ${candidates
        .map(
          (candidate) => `
            <article class="finder-item finder-item--stacked ${candidate.id === selectedId ? "finder-item--active" : ""}">
              <div class="finder-item__meta">
                <strong>${escapeHtml(candidate.companyName || candidate.title || "Company result")}</strong>
                <span>${escapeHtml(candidate.website || "")}</span>
                ${
                  candidate.sponsorFitLabel
                    ? `<small class="finder-item__badge">${escapeHtml(candidate.sponsorFitLabel)}</small>`
                    : ""
                }
                ${
                  candidate.summaryLine || candidate.snippet
                    ? `<small>${escapeHtml(candidate.summaryLine || candidate.snippet || "")}</small>`
                    : ""
                }
              </div>
              <button
                type="button"
                class="${candidate.id === selectedId ? "ghost-button" : "primary-button"} primary-button--compact"
                data-action="${action}"
                data-id="${escapeHtml(candidate.id)}"
              >
                ${escapeHtml(buttonLabel)}
              </button>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSelectedCompanyCandidateDetail(candidate) {
  if (!candidate) {
    return `
      <div class="finder-summary finder-summary--selected">
        <div class="finder-section__head">
          <strong>Selected Company</strong>
          <span>Pick a result to preview it here.</span>
        </div>
        <p class="research-empty">Run the finder, then use the list on the right to preview the best matches.</p>
      </div>
    `;
  }

  const note =
    candidate.sponsorSignalsLine ||
    (candidate.sponsorEmail ? `Public email: ${candidate.sponsorEmail}` : "") ||
    "No strong public sponsor signal was found on the scanned pages.";

  return `
    <div class="finder-summary finder-summary--selected">
      <div class="finder-section__head">
        <strong>${escapeHtml(candidate.companyName || "Selected Company")}</strong>
        ${candidate.sponsorFitLabel ? `<small class="finder-item__badge">${escapeHtml(candidate.sponsorFitLabel)}</small>` : ""}
      </div>
      ${candidate.website ? `<span>${escapeHtml(candidate.website)}</span>` : ""}
      ${
        candidate.summaryLine || candidate.snippet
          ? `<p class="research-empty">${escapeHtml(candidate.summaryLine || candidate.snippet || "")}</p>`
          : ""
      }
      <p class="research-empty">${escapeHtml(note)}</p>
      <div class="finder-actions finder-actions--inline">
        <button
          type="button"
          class="primary-button primary-button--full"
          data-action="select-company-candidate"
          data-id="${escapeHtml(candidate.id)}"
        >
          Select for Main Form
        </button>
      </div>
    </div>
  `;
}

export function renderCompanyModal(modalState, company) {
  const isOpen = modalState.open;
  const isEditing = Boolean(modalState.companyId);
  const isSaving = Boolean(modalState.saving);
  const showProposalDate = Boolean(company.hasProposalDate || company.proposalDate);
  const showInterviewDate = Boolean(company.hasInterviewDate || company.interviewDate);
  const suggestedFollowUp = company.firstContacted
    ? addDaysToInputDate(company.firstContacted, 7)
    : "";
  const followUpHint = suggestedFollowUp
    ? `Auto-scheduled for ${suggestedFollowUp} from first contact.`
    : "Set a first contact date to auto-schedule a follow-up one week later.";
  const researchResult = modalState.researchResult;
  const researchCandidates = researchResult?.candidates || [];
  const companyCandidates = researchResult?.companyCandidates || [];
  const researchWarnings = researchResult?.warnings || [];
  const selectedCompanyCandidate =
    companyCandidates.find((candidate) => candidate.id === modalState.selectedCompanyCandidateId) ||
    companyCandidates[0] ||
    null;
  const isWebsiteMode = modalState.researchMode === "website";
  const isIndustryMode = modalState.companySearchMode === "industry";
  const primaryFinderLabel = isWebsiteMode
    ? "Company Name (optional)"
    : isIndustryMode
      ? "Industry"
      : "Company Name";
  const primaryFinderPlaceholder = isWebsiteMode
    ? "Atomic sponsor target"
    : isIndustryMode
      ? "insurance, engineering, print"
      : "Morris Prints";
  const contextLabel = isIndustryMode ? "Company Name / Extra Clue" : "Context";
  const contextPlaceholder = isIndustryMode
    ? "Ancile, London, travel insurance"
    : "insurance, manufacturing, engineering";
  const finderHelpText = isWebsiteMode
    ? "Add a public website to scan named contacts, public emails, and page locations."
    : isIndustryMode
      ? "Search by industry first, then use the extra clue field to bias the shortlist toward the right company."
      : "Search by company name, then rank the likely matches by your context before scanning one.";

  return `
    <div class="modal-backdrop ${isOpen ? "is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Company Capture</span>
            <h3>${isEditing ? "Edit Sponsor Record" : "Add Sponsor Record"}</h3>
          </div>
          <button type="button" class="ghost-button" data-action="close-modal">Close</button>
        </div>
        <div class="modal-layout">
          <form id="company-form" class="form-grid modal-main">
            <input type="hidden" name="id" value="${escapeHtml(company.id || "")}" />
            <section class="finder-summary finder-summary--selected field--span-2">
              <div class="finder-section__head">
                <strong>Selected Company Details</strong>
                <span>Filled from the finder, but you can still tweak them here.</span>
              </div>
              <div class="form-grid form-grid--compact">
                <label class="field">
                  <span>Company Name</span>
                  <input name="companyName" required value="${escapeHtml(company.companyName || "")}" />
                </label>
                <label class="field">
                  <span>Company Website</span>
                  <input
                    name="website"
                    type="url"
                    placeholder="https://company-site.com"
                    value="${escapeHtml(company.website || "")}"
                  />
                </label>
              </div>
            </section>
            <label class="field">
              <span>Contact Name</span>
              <input name="contactName" value="${escapeHtml(company.contactName || "")}" />
            </label>
            <label class="field">
              <span>Contact Role</span>
              <input name="contactRole" value="${escapeHtml(company.contactRole || "")}" />
            </label>
            <label class="field">
              <span>Contact Email</span>
              <input name="contactEmail" type="email" value="${escapeHtml(company.contactEmail || "")}" />
            </label>
            <label class="field">
              <span>Status</span>
              <select name="status">${renderOptions(companyStatusOptions, company.status)}</select>
            </label>
            <label class="field">
              <span>Response Status</span>
              <select name="responseStatus">${renderOptions(
                responseStatusOptions,
                company.responseStatus
              )}</select>
            </label>
            <label class="field">
              <span>Ask Type</span>
              <select name="askType">${renderOptions(askTypeOptions, company.askType)}</select>
            </label>
            <label class="field">
              <span>Ask Value (GBP)</span>
              <input name="askValue" type="number" min="0" step="100" value="${company.askValue || 0}" />
            </label>
            <label class="field">
              <span>Confirmed Value (GBP)</span>
              <input
                name="contributionValue"
                type="number"
                min="0"
                step="100"
                value="${company.contributionValue || 0}"
              />
            </label>
            <label class="field">
              <span>Contribution Type</span>
              <input name="contributionType" value="${escapeHtml(company.contributionType || "")}" />
            </label>
            <label class="field">
              <span>First Contacted</span>
              <input
                name="firstContacted"
                type="date"
                value="${toInputDate(company.firstContacted)}"
                data-followup-source="true"
              />
            </label>
            <label class="field">
              <span>Next Follow-Up</span>
              <input
                name="nextFollowUp"
                type="date"
                value="${toInputDate(company.nextFollowUp)}"
                data-followup-target="true"
                data-auto-managed="${company.nextFollowUp ? "false" : "true"}"
              />
              <small class="field-hint">${followUpHint}</small>
            </label>
            <div class="field field--checkbox">
              <span>Proposal Needed</span>
              <label class="toggle-row">
                <input
                  name="hasProposalDate"
                  type="checkbox"
                  ${showProposalDate ? "checked" : ""}
                />
                <strong>Track a proposal date</strong>
              </label>
            </div>
            <div class="field field--checkbox">
              <span>Interview Needed</span>
              <label class="toggle-row">
                <input
                  name="hasInterviewDate"
                  type="checkbox"
                  ${showInterviewDate ? "checked" : ""}
                />
                <strong>Track an interview date</strong>
              </label>
            </div>
            ${
              showProposalDate
                ? `
                  <label class="field">
                    <span>Proposal Date</span>
                    <input name="proposalDate" type="date" value="${toInputDate(company.proposalDate)}" />
                  </label>
                `
                : `<div class="field field--ghost"></div>`
            }
            ${
              showInterviewDate
                ? `
                  <label class="field">
                    <span>Interview Date</span>
                    <input name="interviewDate" type="date" value="${toInputDate(company.interviewDate)}" />
                  </label>
                `
                : `<div class="field field--ghost"></div>`
            }
            <label class="field field--span-2">
              <span>What They Want From Us</span>
              <textarea name="requestFromUs" rows="3">${escapeHtml(company.requestFromUs || "")}</textarea>
            </label>
            <label class="field field--span-2">
              <span>What They Are Giving In Return</span>
              <textarea name="givingInReturn" rows="3">${escapeHtml(company.givingInReturn || "")}</textarea>
            </label>
            <label class="field field--span-2">
              <span>Research Summary</span>
              <textarea
                name="researchSummary"
                rows="4"
                placeholder="Auto-generated company summary and sponsor-fit notes will appear here."
              >${escapeHtml(company.researchSummary || "")}</textarea>
            </label>
            <label class="field field--span-2">
              <span>Personalisation Notes</span>
              <textarea
                name="personalizationNotes"
                rows="4"
                placeholder="Suggested custom email angles and talking points will appear here."
              >${escapeHtml(company.personalizationNotes || "")}</textarea>
            </label>
            <label class="field field--span-2">
              <span>Notes</span>
              <textarea name="notes" rows="4">${escapeHtml(company.notes || "")}</textarea>
            </label>
            ${
              modalState.error
                ? `<div class="inline-message inline-message--danger field--span-2">${escapeHtml(
                    modalState.error
                  )}</div>`
                : ""
            }
            <div class="modal-actions">
              <button type="button" class="ghost-button" data-action="close-modal" ${isSaving ? "disabled" : ""}>Cancel</button>
              <button
                type="button"
                class="primary-button"
                data-action="save-company"
                ${isSaving ? "disabled" : ""}
              >${isSaving ? "Saving..." : "Save Company"}</button>
            </div>
          </form>
          <aside class="modal-side">
            <section class="panel panel--embedded finder-panel">
              <div class="modal-header modal-header--inline">
                <div>
                  <span class="eyebrow">Finder</span>
                  <h3>Find By Website / Company</h3>
                </div>
              </div>
              <div class="finder-mode-toggle">
                <button
                  type="button"
                  class="editor-tab ${modalState.researchMode === "website" ? "is-active" : ""}"
                  data-action="set-research-mode"
                  data-id="website"
                >
                  Website
                </button>
                <button
                  type="button"
                  class="editor-tab ${modalState.researchMode === "company" ? "is-active" : ""}"
                  data-action="set-research-mode"
                  data-id="company"
                >
                  Company
                </button>
              </div>
              <div class="finder-workspace ${modalState.researchMode === "company" ? "finder-workspace--split" : ""}">
                <div class="finder-workspace__controls">
                  <div class="finder-inputs">
                    <label class="field">
                      <span>${primaryFinderLabel}</span>
                      <input
                        data-finder-field="finderCompanyName"
                        placeholder="${primaryFinderPlaceholder}"
                        value="${escapeHtml(modalState.finderCompanyName || "")}"
                      />
                    </label>
                    ${
                      isWebsiteMode
                        ? `
                          <label class="field">
                            <span>Website URL</span>
                            <input
                              data-finder-field="finderWebsite"
                              type="url"
                              placeholder="https://company-site.com"
                              value="${escapeHtml(modalState.finderWebsite || "")}"
                            />
                          </label>
                        `
                        : `
                          <label class="field">
                            <span>${contextLabel}</span>
                            <input
                              data-finder-field="finderContext"
                              placeholder="${contextPlaceholder}"
                              value="${escapeHtml(modalState.finderContext || "")}"
                            />
                          </label>
                          <div class="finder-mode-toggle finder-mode-toggle--sub">
                            <button
                              type="button"
                              class="editor-tab ${modalState.companySearchMode === "company" ? "is-active" : ""}"
                              data-action="set-company-search-mode"
                              data-id="company"
                            >
                              Company Names
                            </button>
                            <button
                              type="button"
                              class="editor-tab ${modalState.companySearchMode === "industry" ? "is-active" : ""}"
                              data-action="set-company-search-mode"
                              data-id="industry"
                            >
                              Industry
                            </button>
                          </div>
                        `
                    }
                  </div>
                  <p class="finder-help">
                    ${finderHelpText}
                  </p>
                  <div class="finder-actions">
                    <button
                      type="button"
                      class="primary-button primary-button--full"
                      data-action="research-company"
                      ${modalState.researchLoading ? "disabled" : ""}
                    >
                      ${modalState.researchLoading ? "Searching..." : "Run Finder"}
                    </button>
                    ${
                      researchResult
                        ? `<button type="button" class="ghost-button primary-button--full" data-action="apply-research-suggestions">
                            Apply Overall Suggestions
                          </button>`
                        : ""
                    }
                  </div>
                  ${
                    modalState.researchError
                      ? `<div class="inline-message inline-message--danger">${escapeHtml(modalState.researchError)}</div>`
                      : ""
                  }
                  ${
                    researchWarnings.length
                      ? `
                        <div class="inline-message inline-message--warning">
                          ${researchWarnings.map((warning) => escapeHtml(warning)).join("<br />")}
                        </div>
                      `
                      : ""
                  }
                  ${
                    modalState.researchMode === "company"
                      ? renderSelectedCompanyCandidateDetail(selectedCompanyCandidate)
                      : researchResult
                      ? `
                        <div class="finder-summary">
                          <strong>${escapeHtml(researchResult.website || researchResult.companyName || "Finder results")}</strong>
                          <span>${escapeHtml(researchResult.summary || "No summary generated.")}</span>
                        </div>
                      `
                      : `<p class="research-empty">Run the finder to build a selectable list of public emails and contact clues.</p>`
                  }
                </div>
                ${
                  modalState.researchMode === "company"
                    ? `
                      <div class="finder-workspace__results">
                        <div class="finder-section">
                          <div class="finder-section__head">
                            <strong>Potential Companies</strong>
                            <span>${escapeHtml(String(companyCandidates.length))}</span>
                          </div>
                          ${renderCompanyCandidateList(
                            companyCandidates,
                            selectedCompanyCandidate?.id || "",
                            "preview-company-candidate",
                            "View"
                          )}
                        </div>
                      </div>
                    `
                    : ""
                }
              </div>
              ${
                researchResult?.website
                  ? `
                    <div class="finder-section">
                      <div class="finder-section__head">
                        <strong>Found Emails</strong>
                        <span>${escapeHtml(String(researchCandidates.length))}</span>
                      </div>
                      ${renderResearchCandidateList(researchCandidates, "select-research-candidate", "Select")}
                    </div>
                  `
                  : ""
              }
              <div class="finder-section">
                <div class="finder-section__head">
                  <strong>Completed</strong>
                  <span>${escapeHtml(String(modalState.completedResearchEntries.length || 0))}</span>
                </div>
                ${
                  modalState.completedResearchEntries.length
                    ? renderResearchCandidateList(
                        modalState.completedResearchEntries,
                        "reopen-completed-research",
                        "Amend"
                      )
                    : `<p class="research-empty">When you click Select on a result, it will move here so you can reopen and amend it later.</p>`
                }
              </div>
              ${
                researchResult
                  ? `
                    <div class="finder-section">
                      <div class="finder-section__head">
                        <strong>Suggested angle</strong>
                        <span>${escapeHtml(researchResult.recommendedAskTypeLabel || "General")}</span>
                      </div>
                      <p class="finder-help">${escapeHtml(researchResult.personalization || "No personalisation ideas generated.")}</p>
                    </div>
                  `
                  : ""
              }
            </section>
          </aside>
        </div>
      </div>
    </div>
  `;
}
