import { escapeHtml, formatDate } from "../../utils/formatters.js";

function renderTemplateCards(templates, drafts) {
  return templates
    .map((template) => {
      const linkedDrafts = drafts.filter((draft) => draft.templateId === template.id);

      return `
        <article class="template-card panel">
          <div class="template-card-head">
            <div>
              <span class="eyebrow">Template</span>
              <h3>${escapeHtml(template.name)}</h3>
            </div>
            <span class="badge badge--outline">${escapeHtml(template.category)}</span>
          </div>
          <p class="template-subject-line">${escapeHtml(template.subject)}</p>
          <div class="template-card-actions">
            <button type="button" class="primary-button" data-action="open-template-editor" data-id="${template.id}">
              Edit Template
            </button>
            <button type="button" class="ghost-button" data-action="open-draft-editor" data-id="${template.id}">
              Draft Email
            </button>
          </div>
          <div class="template-meta-row">
            <span>${linkedDrafts.length} saved draft${linkedDrafts.length === 1 ? "" : "s"}</span>
            <small>${escapeHtml(template.category)}</small>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderEmailStudioView({ templates, drafts }) {
  const templateMarkup = templates.length
    ? renderTemplateCards(templates, drafts)
    : `
      <div class="panel empty-state">
        <h3>No templates yet</h3>
        <p>Create your first template, then open it in the visual editor and draft emails from it.</p>
      </div>
    `;

  const draftMarkup = drafts.length
    ? drafts
        .map(
          (draft) => `
            <button type="button" class="draft-row" data-action="open-saved-draft" data-id="${draft.id}">
              <div>
                <strong>${escapeHtml(draft.name)}</strong>
                <span>${escapeHtml(draft.companyName || "No company selected")}</span>
              </div>
              <small>${escapeHtml(formatDate(draft.updatedAt))}</small>
            </button>
          `
        )
        .join("")
    : `<div class="empty-inline">Drafts you save will appear here.</div>`;

  return `
    <section id="emails" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Email Studio</span>
          <h2>Templates & Drafts</h2>
        </div>
        <div class="template-hub-actions">
          <button type="button" class="ghost-button" data-action="open-template-import">Import Template</button>
          <button type="button" class="primary-button" data-action="new-template">Create Template</button>
        </div>
      </div>
      <input id="template-import-input" type="file" accept=".html,.htm,.txt,text/html" hidden />
      <div class="template-hub-grid">
        <div class="template-card-stack">
          ${templateMarkup}
        </div>
        <aside class="panel draft-rail">
          <span class="eyebrow">Saved Drafts</span>
          <h3>One-Off Email Versions</h3>
          <p>Draft mode lets you change wording, blocks, and layout without changing the master template.</p>
          <div class="draft-rail-list">
            ${draftMarkup}
          </div>
        </aside>
      </div>
    </section>
  `;
}
