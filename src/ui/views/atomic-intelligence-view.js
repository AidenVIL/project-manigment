import { escapeHtml, formatDate } from "../../utils/formatters.js";

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

function renderConversationItem(conversation = {}, selectedId = "") {
  const firstUser = (conversation.messages || []).find((message) => message.role === "user")?.text || "New AI chat";
  const preview = `${String(firstUser || "").slice(0, 80)}`;

  return `
    <button
      type="button"
      class="chat-history-item ${conversation.id === selectedId ? "is-active" : ""}"
      data-action="open-intelligence-conversation"
      data-id="${escapeHtml(conversation.id || "")}"
    >
      <strong>${escapeHtml(conversation.title || "New AI chat")}</strong>
      <span>${escapeHtml(preview)}</span>
      <small>${escapeHtml(formatDate(conversation.updatedAt || conversation.createdAt))}</small>
    </button>
  `;
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
  const conversations = Array.isArray(intelligenceState.conversations) ? intelligenceState.conversations : [];
  const activeTab = intelligenceState.activeTab || "chat";
  const activeConversation = conversations.find((entry) => entry.id === intelligenceState.activeConversationId) || {
    title: "New AI chat",
    messages
  };

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
            <div class="chat-history-grid">
              <section class="panel chat-history-list">
                <div class="section-header">
                  <div>
                    <strong>Previous chats</strong>
                    <p class="muted-copy">Select an existing conversation or start a fresh AI session.</p>
                  </div>
                  <button type="button" class="primary-button primary-button--compact" data-action="new-intelligence-conversation">
                    New chat
                  </button>
                </div>
                ${
                  conversations.length
                    ? conversations.map((conversation) => renderConversationItem(conversation, intelligenceState.activeConversationId)).join("")
                    : `<p class="muted-copy">No previous chats yet. Start one by asking a question.</p>`
                }
              </section>

              <section class="intel-chat panel">
                <div class="intel-chat__header">
                  <div>
                    <strong>${escapeHtml(activeConversation.title || "New AI chat")}</strong>
                    <p class="muted-copy">${escapeHtml(activeConversation.updatedAt ? formatDate(activeConversation.updatedAt) : "New conversation")}</p>
                  </div>
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
              </section>
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

