import { escapeHtml } from "../../utils/formatters.js";

function renderTemplateOptions(templates, selectedTemplateId) {
  return templates
    .map(
      (template) => `
        <option value="${template.id}" ${template.id === selectedTemplateId ? "selected" : ""}>
          ${escapeHtml(template.name)}
        </option>
      `
    )
    .join("");
}

export function renderFollowUpWorkflowModal({
  workflow,
  templates,
  company,
  preview,
  gmailConnected
}) {
  if (!workflow?.open || !workflow.event) {
    return "";
  }

  const hasCompanyEmail = Boolean(company?.contactEmail);
  const canSend = Boolean(gmailConnected && hasCompanyEmail && workflow.selectedTemplateId);

  return `
    <div class="modal-backdrop is-open" aria-hidden="false">
      <div class="modal-card modal-card--workflow">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Follow-Up Workflow</span>
            <h3>${escapeHtml(workflow.event.companyName)}</h3>
            <p class="editor-help">${escapeHtml(workflow.event.type)} due on ${escapeHtml(workflow.event.date)}</p>
          </div>
          <button type="button" class="ghost-button" data-action="close-follow-up-workflow">Close</button>
        </div>
        <div class="workflow-steps">
          <article class="workflow-step">
            <span class="eyebrow">Step 1</span>
            <h4>Choose a template</h4>
            <p>Pick the message you want to use for this follow-up.</p>
            <label class="field">
              <span>Template</span>
              <select data-action="change-follow-up-template" id="follow-up-template-select">
                <option value="">Select a template</option>
                ${renderTemplateOptions(templates, workflow.selectedTemplateId)}
              </select>
            </label>
          </article>
          <article class="workflow-step">
            <span class="eyebrow">Step 2</span>
            <h4>Review the drafted email</h4>
            <p>The subject and content are filled using the company data you already saved.</p>
            <div class="workflow-preview">
              <div class="workflow-preview__head">
                <span>To</span>
                <strong>${escapeHtml(company?.contactEmail || "No contact email saved")}</strong>
              </div>
              <div class="workflow-preview__head">
                <span>Subject</span>
                <strong>${escapeHtml(preview?.subject || "Select a template to generate a subject")}</strong>
              </div>
              <div class="workflow-preview__body">
                ${
                  preview?.html
                    ? preview.html
                    : `<p class="editor-help">Choose a template to preview the email.</p>`
                }
              </div>
            </div>
          </article>
          <article class="workflow-step">
            <span class="eyebrow">Step 3</span>
            <h4>Send or tweak</h4>
            <p>Send it now if everything looks good, or open a draft editor if you want to adjust wording first.</p>
            ${
              !hasCompanyEmail
                ? `<div class="inline-message inline-message--danger">This company does not have a contact email yet.</div>`
                : ""
            }
            ${
              !gmailConnected
                ? `<div class="inline-message">Connect Gmail in the Mailbox section before sending from the app.</div>`
                : ""
            }
            ${
              workflow.error
                ? `<div class="inline-message inline-message--danger">${escapeHtml(workflow.error)}</div>`
                : ""
            }
            <div class="workflow-actions">
              <button
                type="button"
                class="ghost-button"
                data-action="open-follow-up-draft-editor"
                ${workflow.selectedTemplateId ? "" : "disabled"}
              >
                Open In Draft Editor
              </button>
              <button
                type="button"
                class="primary-button"
                data-action="send-follow-up-email"
                ${canSend && !workflow.sending ? "" : "disabled"}
              >
                ${workflow.sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  `;
}
