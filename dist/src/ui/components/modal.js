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

export function renderCompanyModal(modalState, company) {
  const isOpen = modalState.open;
  const isEditing = Boolean(modalState.companyId);
  const isSaving = Boolean(modalState.saving);
  const suggestedFollowUp = company.firstContacted
    ? addDaysToInputDate(company.firstContacted, 7)
    : "";
  const followUpHint = suggestedFollowUp
    ? `Auto-scheduled for ${suggestedFollowUp} from first contact.`
    : "Set a first contact date to auto-schedule a follow-up one week later.";

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
        <form id="company-form" class="form-grid">
          <input type="hidden" name="id" value="${escapeHtml(company.id || "")}" />
          <label class="field field--span-2">
            <span>Company Name</span>
            <input name="companyName" required value="${escapeHtml(company.companyName || "")}" />
          </label>
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
            <span>Sector</span>
            <input name="sector" value="${escapeHtml(company.sector || "")}" />
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
          <label class="field">
            <span>Proposal Date</span>
            <input name="proposalDate" type="date" value="${toInputDate(company.proposalDate)}" />
          </label>
          <label class="field">
            <span>Interview Date</span>
            <input name="interviewDate" type="date" value="${toInputDate(company.interviewDate)}" />
          </label>
          <label class="field field--span-2">
            <span>What They Want From Us</span>
            <textarea name="requestFromUs" rows="3">${escapeHtml(company.requestFromUs || "")}</textarea>
          </label>
          <label class="field field--span-2">
            <span>What They Are Giving In Return</span>
            <textarea name="givingInReturn" rows="3">${escapeHtml(company.givingInReturn || "")}</textarea>
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
              data-action="submit-company-form"
              ${isSaving ? "disabled" : ""}
            >${isSaving ? "Saving..." : "Save Company"}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
