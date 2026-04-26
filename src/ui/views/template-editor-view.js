import {
  blockDefinitions,
  editorTabs,
  variableDefinitions
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

function renderDropZone(index, compact = false) {
  return `
    <div class="editor-dropzone ${compact ? "editor-dropzone--compact" : ""}" data-drop-index="${index}">
      <span>Drop block here</span>
    </div>
  `;
}

function renderLayersPanel(editor) {
  return `
    <div class="editor-pane-list">
      <button type="button" class="layer-row ${editor.selectedBlockId === "body" ? "is-active" : ""}" data-action="select-editor-body">
        <span>Body</span>
        <small>Canvas</small>
      </button>
      <div class="layer-drop-stack">
        ${renderDropZone(0, true)}
        ${editor.design.blocks
          .map(
            (block, index) => `
              <div class="layer-item-stack">
                <button
                  type="button"
                  class="layer-row ${editor.selectedBlockId === block.id ? "is-active" : ""}"
                  data-action="select-editor-block"
                  data-id="${block.id}"
                  draggable="true"
                  data-drag-kind="existing-block"
                >
                  <span>${index + 1}. ${escapeHtml(block.name || block.type)}</span>
                  <small>${escapeHtml(block.type)}</small>
                </button>
                ${renderDropZone(index + 1, true)}
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderVariablesPanel(previewTokens) {
  return `
    <div class="variable-panel">
      <div class="editor-section-label">
        <span class="eyebrow">Variables</span>
        <p>Click one to insert it into the subject or the selected text field.</p>
      </div>
      <div class="variable-groups">
        ${variableDefinitions
          .map(
            (group) => `
              <section class="variable-group">
                <h4>${escapeHtml(group.label)}</h4>
                <div class="variable-list">
                  ${group.items
                    .map(
                      (item) => `
                        <button
                          type="button"
                          class="variable-card"
                          data-action="insert-token"
                          data-id="${escapeHtml(item.token)}"
                        >
                          <strong>${escapeHtml(item.label)}</strong>
                          <span>${escapeHtml(item.help)}</span>
                          <code>${escapeHtml(item.key || item.token)}</code>
                          <small>Example: ${escapeHtml(String(previewTokens?.[item.key] || "Not available yet"))}</small>
                        </button>
                      `
                    )
                    .join("")}
                </div>
              </section>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBlocksPanel(editor, previewTokens) {
  return `
    <div class="editor-pane-list">
      <div class="import-panel">
        <div class="editor-section-label">
          <span class="eyebrow">Import</span>
          <p>Bring in an older HTML email and convert it into editable Atomic blocks.</p>
        </div>
        <div class="import-panel__actions">
          <button type="button" class="ghost-button" data-action="trigger-editor-import-file">Import HTML File</button>
        </div>
        <input id="editor-import-file" type="file" accept=".html,.htm,.txt,text/html" hidden />
        <label class="field">
          <span>Paste HTML</span>
          <textarea
            id="editor-import-html"
            rows="8"
            placeholder="Paste an existing email template here. We will try to recognise headings, body copy, images, dividers, and buttons."
          ></textarea>
        </label>
        <button type="button" class="primary-button" data-action="import-editor-html">
          Replace With Imported HTML
        </button>
        <small class="field-hint">
          Your current ${editor.mode === "template" ? "template" : "draft"} stays editable after import.
        </small>
      </div>
      <div class="editor-section-label">
        <span class="eyebrow">Blocks</span>
        <p>Click or drag a block onto the canvas, then edit it on the right.</p>
      </div>
      <div class="block-grid">
        ${blockDefinitions
          .map(
            (block) => `
              <button
                type="button"
                class="builder-card"
                data-action="add-editor-block"
                data-id="${block.id}"
                draggable="true"
                data-drag-kind="new-block"
                data-block-type="${block.id}"
              >
                <strong>${escapeHtml(block.label)}</strong>
                <span>${escapeHtml(`Add a ${block.label.toLowerCase()} block to the email.`)}</span>
                <small>Drag onto the page</small>
              </button>
            `
          )
          .join("")}
      </div>
      ${renderVariablesPanel(previewTokens)}
    </div>
  `;
}

function buildPreviewDocument(html) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    ${html}
    <script>
      (function () {
        function syncHeight() {
          if (!window.frameElement) {
            return;
          }

          var body = document.body;
          var doc = document.documentElement;
          var nextHeight = Math.max(
            body ? body.scrollHeight : 0,
            doc ? doc.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            doc ? doc.offsetHeight : 0
          );

          window.frameElement.style.height = nextHeight + "px";
        }

        window.addEventListener("load", syncHeight);
        window.addEventListener("resize", syncHeight);
        setTimeout(syncHeight, 0);
      })();
    </script>
  </body>
</html>`;
}

function renderCanvas(previewHtml, canvas, selectedBlockId, device) {
  const viewportWidth = device === "mobile" ? 390 : Number(canvas?.width || 680);
  const previewDocument = buildPreviewDocument(previewHtml);

  return `
    <div class="canvas-stage">
      <div
        class="canvas-preview-shell ${selectedBlockId === "body" ? "is-selected" : ""}"
        style="width:${Number(viewportWidth)}px;"
        data-action="select-editor-body"
      >
        <iframe
          class="canvas-preview-frame"
          title="Exact email preview"
          sandbox="allow-same-origin allow-scripts"
          scrolling="no"
          srcdoc="${escapeHtml(previewDocument)}"
        ></iframe>
      </div>
    </div>
  `;
}

function renderBodyInspector(editor) {
  return `
    <div class="inspector-group">
      <span class="eyebrow">Canvas</span>
      <p class="editor-help">Drag a block in the preview to adjust its spacing visually.</p>
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
      <span>Padding Left</span>
      <input data-editor-scope="block-style" data-editor-field="paddingLeft" type="number" value="${Number(styles.paddingLeft ?? styles.paddingX ?? 0)}" />
    </label>
    <label class="field">
      <span>Padding Right</span>
      <input data-editor-scope="block-style" data-editor-field="paddingRight" type="number" value="${Number(styles.paddingRight ?? styles.paddingX ?? 0)}" />
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
      <p class="editor-help">Drag this block in the preview to move it left, right, up, or down using spacing.</p>
      <div class="inspector-toolbar">
        <button type="button" class="ghost-button" data-action="duplicate-block" data-id="${block.id}">Duplicate</button>
        <button type="button" class="ghost-button" data-action="move-block-up" data-id="${block.id}">Up</button>
        <button type="button" class="ghost-button" data-action="move-block-down" data-id="${block.id}">Down</button>
        <button type="button" class="ghost-button ghost-button--danger" data-action="delete-block" data-id="${block.id}">Delete</button>
      </div>
      <div class="form-grid">
        ${contentFields}
        ${styleFields}
      </div>
    </div>
  `;
}

function renderWritingCoach(preview) {
  const writing = preview.writing;

  return `
    <div class="inspector-group">
      <span class="eyebrow">Writing Coach</span>
      <div class="writing-coach__summary">
        <div class="writing-coach__stat">
          <span>Tone</span>
          <strong>${escapeHtml(writing.tone.label)}</strong>
          <small>${escapeHtml(writing.tone.note)}</small>
        </div>
        <div class="writing-coach__stat">
          <span>Word Count</span>
          <strong>${writing.wordCount}</strong>
          <small>About ${writing.readingTime} min read</small>
        </div>
      </div>
      <div class="writing-coach__list">
        ${
          writing.suggestions.length
            ? writing.suggestions
                .map(
                  (suggestion) => `
                    <article class="writing-coach__card">
                      <h4>${escapeHtml(suggestion.title)}</h4>
                      <p>${escapeHtml(suggestion.detail)}</p>
                      ${
                        suggestion.snippet
                          ? `<p class="writing-coach__issue"><u>${escapeHtml(suggestion.snippet)}</u></p>`
                          : ""
                      }
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-inline">No obvious spelling, grammar, or tone issues found right now.</div>`
        }
      </div>
    </div>
  `;
}

export function renderTemplateEditorView({ editor, company, preview }) {
  return `
    <main class="editor-page">
      <header class="editor-header">
        <div class="editor-header-left">
          <button type="button" class="ghost-button" data-action="close-editor">Back</button>
          <div>
            <span class="eyebrow">${editor.mode === "template" ? "Template Editor" : "Draft Editor"}</span>
            <h1>${escapeHtml(editor.nameInput || "Untitled")}</h1>
            <p>${editor.mode === "template" ? "Master version for future emails." : "One-off version that does not change the master."}</p>
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
              : renderBlocksPanel(editor, preview.tokens || {})
          }
        </aside>
        <section class="editor-canvas-area">
          <div class="editor-canvas-toolbar">
            <span>${editor.mode === "template" ? "Master Template" : "One-Off Draft"}</span>
            <strong>${escapeHtml(company?.companyName || "Preview")}</strong>
          </div>
          ${renderCanvas(preview.html, editor.design.canvas, editor.selectedBlockId, editor.device)}
        </section>
        <aside class="editor-inspector panel">
          ${renderSelectedBlockInspector(editor)}
          <div class="inspector-group">
            <span class="eyebrow">Current Subject</span>
            <p class="editor-help">${escapeHtml(preview.subject)}</p>
          </div>
          ${renderWritingCoach(preview)}
        </aside>
      </div>
    </main>
  `;
}
