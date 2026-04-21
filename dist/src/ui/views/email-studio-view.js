import { escapeHtml } from "../../utils/formatters.js";
import {
  templateBlockLibrary,
  templateBuilderActions
} from "../../services/template-service.js";

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

  const blockMarkup = templateBlockLibrary
    .map(
      (block) => `
        <button type="button" class="builder-card" data-template-block="${block.id}">
          <strong>${escapeHtml(block.name)}</strong>
          <span>${escapeHtml(block.description)}</span>
        </button>
      `
    )
    .join("");

  const actionMarkup = templateBuilderActions
    .map(
      (action) => `
        <button type="button" class="tool-chip" data-template-action="${action.id}">
          ${escapeHtml(action.label)}
        </button>
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
          <div class="editor-topbar">
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
          </div>
          <div class="builder-shell">
            <aside class="builder-sidebar">
              <div class="builder-group">
                <span class="eyebrow">Quick Blocks</span>
                <div class="builder-library">
                  ${blockMarkup}
                </div>
              </div>
              <div class="builder-group">
                <span class="eyebrow">Personalisation Tokens</span>
                <div class="token-grid token-grid--compact">${tokenMarkup}</div>
              </div>
            </aside>
            <div class="builder-workspace">
              <label class="field">
                <span>Subject</span>
                <input id="template-subject" value="${escapeHtml(subjectInput)}" />
              </label>
              <div class="builder-group">
                <span class="eyebrow">Formatting Tools</span>
                <div class="editor-toolbar">
                  ${actionMarkup}
                </div>
              </div>
              <label class="field">
                <span>HTML Body</span>
                <textarea id="template-html" rows="20">${escapeHtml(htmlInput)}</textarea>
              </label>
            </div>
          </div>
          <div class="editor-actions">
            <button type="button" class="primary-button" data-action="save-template">Save Template</button>
            <button type="button" class="ghost-button" data-action="copy-subject">Copy Subject</button>
            <button type="button" class="ghost-button" data-action="copy-html">Copy HTML</button>
          </div>
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
