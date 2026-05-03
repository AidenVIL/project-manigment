import { escapeHtml, formatDate } from "../../utils/formatters.js";

function renderPreview(text = "") {
  const clean = String(text || "").trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
}

function renderConversationItem(conversation = {}, selectedId = "") {
  const firstUserMessage =
    (conversation.messages || []).find((message) => message.role === "user")?.text || "Saved AI chat";

  return `
    <button
      type="button"
      class="chat-history-item ${conversation.id === selectedId ? "is-active" : ""}"
      data-action="open-assistant-history-conversation"
      data-id="${escapeHtml(conversation.id || "")}"
    >
      <strong>${escapeHtml(conversation.title || "Saved AI chat")}</strong>
      <span>${escapeHtml(renderPreview(firstUserMessage))}</span>
      <small>${escapeHtml(formatDate(conversation.updatedAt || conversation.createdAt))}</small>
    </button>
  `;
}

function renderConversationMessage(message = {}) {
  return `
    <article class="chat-history-message chat-history-message--${escapeHtml(message.role || "assistant")}">
      <strong>${escapeHtml(message.role === "user" ? "You" : "Atomic AI")}</strong>
      <p>${escapeHtml(message.text || "")}</p>
    </article>
  `;
}

export function renderAssistantHistoryView(historyState = {}) {
  const conversations = Array.isArray(historyState.conversations) ? historyState.conversations : [];
  const selectedConversation =
    conversations.find((conversation) => conversation.id === historyState.selectedId) ||
    conversations[0] ||
    null;

  return `
    <section id="assistant-history" class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Atomic AI</span>
          <h2>Saved chat history</h2>
          <p>Browse older Atomic AI conversations saved on the server.</p>
        </div>
        <button type="button" class="ghost-button" data-action="refresh-assistant-history">Refresh</button>
      </div>

      ${
        historyState.error
          ? `<div class="inline-message inline-message--danger">${escapeHtml(historyState.error)}</div>`
          : ""
      }

      <div class="chat-history-grid">
        <section class="panel chat-history-list">
          <div class="section-header">
            <div>
              <strong>Saved chats</strong>
              <p>${escapeHtml(String(conversations.length))} conversation${conversations.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          ${
            historyState.loading
              ? `<p class="muted-copy">Loading saved chats...</p>`
              : conversations.length
                ? conversations.map((conversation) => renderConversationItem(conversation, selectedConversation?.id || "")).join("")
                : `<p class="muted-copy">No saved Atomic AI chats yet. Once the team starts using the assistant, chats will appear here.</p>`
          }
        </section>

        <section class="panel chat-history-viewer">
          ${
            selectedConversation
              ? `
                <div class="section-header">
                  <div>
                    <strong>${escapeHtml(selectedConversation.title || "Saved AI chat")}</strong>
                    <p>Updated ${escapeHtml(formatDate(selectedConversation.updatedAt || selectedConversation.createdAt))}</p>
                  </div>
                  <button
                    type="button"
                    class="primary-button primary-button--compact"
                    data-action="load-assistant-history-into-chat"
                    data-id="${escapeHtml(selectedConversation.id || "")}"
                  >
                    Load Into Atomic AI
                  </button>
                </div>
                <div class="chat-history-thread">
                  ${(selectedConversation.messages || []).map(renderConversationMessage).join("")}
                </div>
              `
              : `<p class="muted-copy">Pick a saved conversation to read it here.</p>`
          }
        </section>
      </div>
    </section>
  `;
}
