import { escapeHtml } from "../../utils/formatters.js";

function renderMarkdown(text = "") {
  const escaped = escapeHtml(String(text || ""));
  const withStrong = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withInlineCode = withStrong.replace(/`([^`]+)`/g, "<code>$1</code>");
  const withLinks = withInlineCode.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );
  const paragraphs = withLinks
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${chunk.replace(/\n/g, "<br />")}</p>`);
  return paragraphs.join("");
}

function renderMessage(message = {}) {
  return `
    <article class="intel-chat__message intel-chat__message--${escapeHtml(message.role || "assistant")}">
      <div class="intel-chat__bubble">
        ${renderMarkdown(message.text || "")}
      </div>
    </article>
  `;
}

export function renderAtomicIntelligenceView(intelligenceState = {}) {
  const messages = Array.isArray(intelligenceState.messages) ? intelligenceState.messages : [];
  const activeTab = intelligenceState.activeTab || "chat";

  return `
    <section id="atomic-intelligence" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Atomic Intelligence</span>
          <h2>AI command workspace</h2>
          <p class="helper-copy">Free-first research + sponsor workflow assistant running Pi-friendly.</p>
        </div>
      </div>

      <div class="intel-tabs panel">
        ${[
          ["chat", "AI Chat"],
          ["finder", "Sponsor Finder"],
          ["research", "Company Research"],
          ["news", "News Feed"],
          ["notes", "Saved Notes"],
          ["admin", "Admin Tools"]
        ]
          .map(
            ([id, label]) => `
              <button
                type="button"
                class="intel-tabs__tab ${activeTab === id ? "is-active" : ""}"
                data-action="set-intelligence-tab"
                data-id="${id}"
              >
                ${label}
              </button>
            `
          )
          .join("")}
      </div>

      ${
        activeTab === "chat"
          ? `
            <div class="intel-chat panel">
              <div class="intel-chat__header">
                <strong>Atomic AI Chat</strong>
                <div class="intel-chat__actions">
                  <button type="button" class="ghost-button" data-action="intelligence-clear-chat">Clear Chat</button>
                </div>
              </div>
              <div class="intel-chat__messages">
                ${messages.length ? messages.map(renderMessage).join("") : "<p class='muted-copy'>Start by asking about a company, sponsor strategy, or latest industry news.</p>"}
                ${intelligenceState.loading ? "<div class='intel-chat__typing'>Thinking...</div>" : ""}
              </div>
              <form id="intelligence-chat-form" class="intel-chat__form">
                <textarea
                  id="intelligence-chat-input"
                  name="question"
                  rows="3"
                  placeholder="Ask: 'Find likely UK STEM sponsors in automotive software' or 'Summarise AMD sponsorship potential'"
                  ${intelligenceState.loading ? "disabled" : ""}
                >${escapeHtml(intelligenceState.input || "")}</textarea>
                <div class="intel-chat__form-actions">
                  <button type="submit" class="primary-button" ${intelligenceState.loading ? "disabled" : ""}>
                    ${intelligenceState.loading ? "Running..." : "Send"}
                  </button>
                </div>
              </form>
              ${
                intelligenceState.error
                  ? `<p class="status-text status-text--error">${escapeHtml(intelligenceState.error)}</p>`
                  : ""
              }
            </div>
          `
          : `
            <div class="panel">
              <h3>${escapeHtml(
                activeTab === "finder"
                  ? "Sponsor Finder"
                  : activeTab === "research"
                    ? "Company Research"
                    : activeTab === "news"
                      ? "News Feed"
                      : activeTab === "notes"
                        ? "Saved Notes"
                        : "Admin Tools"
              )}</h3>
              <p class="muted-copy">
                This area is ready and wired for the next phase. Core AI chat is now live in the AI Chat tab.
              </p>
            </div>
          `
      }
    </section>
  `;
}

