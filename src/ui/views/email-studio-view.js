import { escapeHtml } from "../../utils/formatters.js";

function renderOptions(items, selectedId, placeholder) {
  return [
    `<option value="">${placeholder}</option>`,
    ...items.map(
      (item) => `
        <option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>
          ${escapeHtml(item.name || item.companyName)}
        </option>
      `
    )
  ].join("");
}

export function renderEmailStudioView({
  companies,
  templates,
  selectedCompanyId,
  selectedTemplateId,
  subjectInput,
  htmlInput,
  preview
}) {
  const tokenMarkup = Object.entries(preview.tokens || {})
    .map(
      ([key, value]) => `
        <div class="token-card">
          <span>{{${escapeHtml(key)}}}</span>
          <strong>${escapeHtml(String(value))}</strong>
        </div>
      `
    )
    .join("");

  return `
    <section id="emails" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Email Studio</span>
          <h2>Template Builder</h2>
        </div>
        <button type="button" class="ghost-button" data-action="new-template">New Template</button>
      </div>
      <div class="studio-grid">
        <div class="panel editor-panel">
          <div class="editor-controls">
            <label class="field">
              <span>Template</span>
              <select id="template-select">
                ${renderOptions(templates, selectedTemplateId, "Choose a template")}
              </select>
            </label>
            <label class="field">
              <span>Company</span>
              <select id="company-select">
                ${renderOptions(companies, selectedCompanyId, "Choose a company")}
              </select>
            </label>
            <label class="field">
              <span>Subject</span>
              <input id="template-subject" value="${escapeHtml(subjectInput)}" />
            </label>
            <label class="field">
              <span>HTML Body</span>
              <textarea id="template-html" rows="16">${escapeHtml(htmlInput)}</textarea>
            </label>
          </div>
          <div class="editor-actions">
            <button type="button" class="primary-button" data-action="save-template">Save Template</button>
            <button type="button" class="ghost-button" data-action="copy-subject">Copy Subject</button>
            <button type="button" class="ghost-button" data-action="copy-html">Copy HTML</button>
          </div>
          <div class="token-grid">${tokenMarkup}</div>
        </div>
        <div class="panel preview-panel">
          <div class="preview-head">
            <span class="eyebrow">Rendered Preview</span>
            <h3>${escapeHtml(preview.subject || "Select a template")}</h3>
          </div>
          <div class="preview-window">${preview.html || "<p>No preview available yet.</p>"}</div>
        </div>
      </div>
    </section>
  `;
}
