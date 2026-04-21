import {
  availableTokens,
  blockDefinitions,
  editorTabs,
  renderBlockHtml,
  renderTemplateHtmlFromDesign
} from "../../services/template-service.js";
import { escapeHtml } from "../../utils/formatters.js";

function renderTabButtons(activeTab) {
  return editorTabs
    .map(
      (tab) => `
        <button type="button" class="editor-tab ${tab.id === activeTab ? "is-active" : ""}" data-action="switch-editor-tab" data-id="${tab.id}">
          ${escapeHtml(tab.label)}
        </button>
      `
    )
    .join("");
}

function renderLayersPanel(editor) {
  return `
    <div class="editor-pane-list">
      <button type="button" class="layer-row ${editor.selectedBlockId === "body" ? "is-active" : ""}" data-action="select-editor-body">
        <span>Body</span>
      </button>
      ${editor.design.blocks
        .map(
          (block, index) => `
            <button
              type="button"
              class="layer-row ${editor.selectedBlockId === block.id ? "is-active" : ""}"
              data-action="select-editor-block"
              data-id="${block.id}"
            >
              <span>${index + 1}. ${escapeHtml(block.name || block.type)}</span>
              <small>${escapeHtml(block.type)}</small>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderBlocksPanel() {
  return `
    <div class="editor-pane-list">
      ${blockDefinitions
        .map(
          (block) => `
            <button type="button" class="builder-card" data-action="add-editor-block" data-id="${block.id}">
              <strong>${escapeHtml(block.label)}</strong>
              <span>Add a ${escapeHtml(block.label.toLowerCase())} block to the email.</span>
            </button>
          `
        )
        .join("")}
      <div class="token-panel">
        <span class="eyebrow">Tokens</span>
        <div class="token-grid token-grid--compact">
          ${availableTokens
            .map(
              (token) => `
                <button type="button" class="token-card token-card--button" data-action="insert-token" data-id="${escapeHtml(token)}">
                  <span>${escapeHtml(token)}</span>
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderCanvas(design, company, selectedBlockId, device) {
  const width = device === "mobile" ? 390 : design.canvas.width;

  return `
    <div class="canvas-stage">
      <div class="canvas-surface" style="width:${Number(width)}px; background:${design.canvas.bodyBackground};">
        <div
          class="canvas-email ${selectedBlockId === "body" ? "is-selected" : ""}"
          data-action="select-editor-body"
          style="background:${design.canvas.emailBackground}; border-radius:${Number(design.canvas.radius || 0)}px;"
        >
          ${design.blocks
            .map((block) => `
              <div
                class="canvas-block ${selectedBlockId === block.id ? "is-selected" : ""}"
                data-action="select-editor-block"
                data-id="${block.id}"
              >
                <div class="canvas-block__content">
                  ${renderBlockHtml(block, company, design.canvas)}
                </div>
              </div>
            `)
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderBodyInspector(editor) {
  return `
    <div class="inspector-group">
      <span class="eyebrow">Canvas</span>
      <label class="field">
        <span>Email Width</span>
        <input data-editor-scope="canvas" data-editor-field="width" type="number" value="${Number(editor.design.canvas.width)}" />
      </label>
      <label class="field">
        <span>Outer Background</span>
        <input data-editor-scope="canvas" data-editor-field="bodyBackground" value="${escapeHtml(editor.design.canvas.bodyBackground)}" />
      </label>
      <label class="field">
        <span>Email Background</span>
        <input data-editor-scope="canvas" data-editor-field="emailBackground" value="${escapeHtml(editor.design.canvas.emailBackground)}" />
      </label>
    </div>
  `;
}

function renderSelectedBlockInspector(editor) {
  const block = editor.design.blocks.find((item) => item.id === editor.selectedBlockId);
  if (!block) {
    return renderBodyInspector(editor);
  }

  const styles = block.styles || {};
  const content = block.content || {};
  const sharedStyleFields = `
    <label class="field">
      <span>Align</span>
      <select data-editor-scope="block-style" data-editor-field="align">
        ${["left", "center", "right"]
          .map(
            (align) => `
              <option value="${align}" ${String(styles.align || "left") === align ? "selected" : ""}>${align}</option>
            `
          )
          .join("")}
      </select>
    </label>
    <label class="field">
      <span>Padding X</span>
      <input data-editor-scope="block-style" data-editor-field="paddingX" type="number" value="${Number(styles.paddingX || 0)}" />
    </label>
    <label class="field">
      <span>Padding Top</span>
      <input data-editor-scope="block-style" data-editor-field="paddingTop" type="number" value="${Number(styles.paddingTop || 0)}" />
    </label>
    <label class="field">
      <span>Padding Bottom</span>
      <input data-editor-scope="block-style" data-editor-field="paddingBottom" type="number" value="${Number(styles.paddingBottom || 0)}" />
    </label>
  `;

  let contentFields = "";
  let styleFields = sharedStyleFields;

  if (block.type === "heading" || block.type === "paragraph") {
    contentFields = `
      <label class="field field--span-2">
        <span>Text</span>
        <textarea data-editor-scope="block-content" data-editor-field="text" rows="7">${escapeHtml(content.text || "")}</textarea>
      </label>
    `;
    styleFields += `
      <label class="field">
        <span>Font Size</span>
        <input data-editor-scope="block-style" data-editor-field="fontSize" type="number" value="${Number(styles.fontSize || 16)}" />
      </label>
      <label class="field">
        <span>Text Color</span>
        <input data-editor-scope="block-style" data-editor-field="color" value="${escapeHtml(styles.color || "#111111")}" />
      </label>
    `;
  }

  if (block.type === "image") {
    contentFields = `
      <label class="field field--span-2">
        <span>Image URL or Path</span>
        <input data-editor-scope="block-content" data-editor-field="src" value="${escapeHtml(content.src || "")}" />
      </label>
      <label class="field field--span-2">
        <span>Alt Text</span>
        <input data-editor-scope="block-content" data-editor-field="alt" value="${escapeHtml(content.alt || "")}" />
      </label>
    `;
    styleFields += `
      <label class="field">
        <span>Width</span>
        <input data-editor-scope="block-style" data-editor-field="width" type="number" value="${Number(styles.width || 120)}" />
      </label>
    `;
  }

  if (block.type === "button") {
    contentFields = `
      <label class="field field--span-2">
        <span>Label</span>
        <input data-editor-scope="block-content" data-editor-field="label" value="${escapeHtml(content.label || "")}" />
      </label>
      <label class="field field--span-2">
        <span>URL</span>
        <input data-editor-scope="block-content" data-editor-field="url" value="${escapeHtml(content.url || "")}" />
      </label>
    `;
    styleFields += `
      <label class="field">
        <span>Background</span>
        <input data-editor-scope="block-style" data-editor-field="backgroundColor" value="${escapeHtml(styles.backgroundColor || "#32ce32")}" />
      </label>
      <label class="field">
        <span>Text Color</span>
        <input data-editor-scope="block-style" data-editor-field="color" value="${escapeHtml(styles.color || "#041004")}" />
      </label>
    `;
  }

  if (block.type === "divider") {
    contentFields = `<p class="editor-help">A divider block only uses spacing and line colour.</p>`;
    styleFields += `
      <label class="field">
        <span>Line Color</span>
        <input data-editor-scope="block-style" data-editor-field="color" value="${escapeHtml(styles.color || "#d9e5d9")}" />
      </label>
    `;
  }

  if (block.type === "spacer") {
    contentFields = `<p class="editor-help">Spacer blocks are useful for breathing room between sections.</p>`;
    styleFields = `
      <label class="field">
        <span>Height</span>
        <input data-editor-scope="block-style" data-editor-field="height" type="number" value="${Number(styles.height || 24)}" />
      </label>
    `;
  }

  return `
    <div class="inspector-group">
      <span class="eyebrow">Selected Block</span>
      <h3>${escapeHtml(block.name || block.type)}</h3>
      <div class="inspector-toolbar">
        <button type="button" class="ghost-button" data-action="move-block-up" data-id="${block.id}">Move Up</button>
        <button type="button" class="ghost-button" data-action="move-block-down" data-id="${block.id}">Move Down</button>
        <button type="button" class="ghost-button ghost-button--danger" data-action="delete-block" data-id="${block.id}">Delete</button>
      </div>
      <div class="form-grid">
        ${contentFields}
        ${styleFields}
      </div>
    </div>
  `;
}

export function renderTemplateEditorView({ editor, company }) {
  const preview = {
    subject: editor.subjectInput,
    html: renderTemplateHtmlFromDesign(editor.design, company)
  };

  return `
    <main class="editor-page">
      <header class="editor-header">
        <div class="editor-header-left">
          <button type="button" class="ghost-button" data-action="close-editor">Back</button>
          <div>
            <span class="eyebrow">${editor.mode === "template" ? "Template Editor" : "Draft Editor"}</span>
            <h1>${escapeHtml(editor.nameInput || "Untitled")}</h1>
            <p>${editor.mode === "template" ? "Saving here updates the master template for future use." : "Changes here only affect this draft email."}</p>
          </div>
        </div>
        <div class="editor-header-right">
          <div class="device-toggle">
            <button type="button" class="${editor.device === "desktop" ? "is-active" : ""}" data-action="set-editor-device" data-id="desktop">Desktop</button>
            <button type="button" class="${editor.device === "mobile" ? "is-active" : ""}" data-action="set-editor-device" data-id="mobile">Mobile</button>
          </div>
          <button type="button" class="ghost-button" data-action="copy-editor-subject">Copy Subject</button>
          <button type="button" class="ghost-button" data-action="copy-editor-html">Copy HTML</button>
          <button type="button" class="primary-button" data-action="${editor.mode === "template" ? "save-template-editor" : "save-draft-editor"}">
            ${editor.mode === "template" ? "Save Template" : "Save Draft"}
          </button>
        </div>
      </header>
      <div class="editor-subheader">
        <label class="field">
          <span>Name</span>
          <input id="editor-name" value="${escapeHtml(editor.nameInput)}" />
        </label>
        <label class="field">
          <span>Subject</span>
          <input id="editor-subject" value="${escapeHtml(editor.subjectInput)}" />
        </label>
        <label class="field">
          <span>Preview Company</span>
          <select id="editor-company">
            ${editor.companyOptions
              .map(
                (option) => `
                  <option value="${option.id}" ${option.id === editor.companyId ? "selected" : ""}>
                    ${escapeHtml(option.companyName)}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>
      </div>
      <div class="editor-layout">
        <aside class="editor-sidebar panel">
          <div class="editor-tabs">
            ${renderTabButtons(editor.sidebarTab)}
          </div>
          ${
            editor.sidebarTab === "layers"
              ? renderLayersPanel(editor)
              : renderBlocksPanel()
          }
        </aside>
        <section class="editor-canvas-area">
          <div class="editor-canvas-toolbar">
            <span>${editor.mode === "template" ? "Master Template" : "One-Off Draft"}</span>
            <strong>${escapeHtml(company?.companyName || "Preview")}</strong>
          </div>
          ${renderCanvas(editor.design, company, editor.selectedBlockId, editor.device)}
        </section>
        <aside class="editor-inspector panel">
          ${renderSelectedBlockInspector(editor)}
          <div class="inspector-group">
            <span class="eyebrow">Current Subject</span>
            <p class="editor-help">${escapeHtml(preview.subject)}</p>
          </div>
        </aside>
      </div>
    </main>
  `;
}
