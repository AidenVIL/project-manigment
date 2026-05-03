import { escapeHtml, formatDate } from "../../utils/formatters.js";

function renderMailboxHeader(mailbox) {
  const canConnect = mailbox.connectEnabled !== false;
  return `
    <div class="section-header mailbox-header">
      <div>
        <span class="eyebrow">Gmail Workspace</span>
        <h2>Team Inbox</h2>
      </div>
      <div class="mailbox-actions">
        ${
          mailbox.connected
            ? `
              <button type="button" class="ghost-button" data-action="refresh-mailbox">Refresh</button>
              <button type="button" class="ghost-button ghost-button--danger" data-action="disconnect-gmail">Disconnect</button>
            `
            : `
              ${
                canConnect
                  ? `<a href="${escapeHtml(mailbox.connectUrl)}" class="primary-button">Connect Gmail</a>`
                  : `<button type="button" class="primary-button" disabled>Connect Gmail</button>`
              }
            `
        }
      </div>
    </div>
  `;
}

function renderInboxList(mailbox) {
  if (mailbox.loading) {
    return `<div class="empty-inline gmail-empty">Loading inbox...</div>`;
  }

  if (!mailbox.messages.length) {
    return `<div class="empty-inline gmail-empty">No messages found for this search.</div>`;
  }

  return `
    <div class="mailbox-list">
      ${mailbox.messages
        .map(
          (message) => `
            <button
              type="button"
              class="mail-item ${mailbox.selectedMessageId === message.id ? "is-active" : ""}"
              data-action="open-mailbox-message"
              data-id="${message.id}"
            >
              <span class="mail-item__avatar">${escapeHtml((message.from || "?").trim().slice(0, 1).toUpperCase())}</span>
              <span class="mail-item__main">
                <span class="mail-item__sender">${escapeHtml(message.from || "Unknown sender")}</span>
                <strong>${escapeHtml(message.subject || "(No subject)")}</strong>
                <small>${escapeHtml(message.snippet || "")}</small>
              </span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSelectedMessage(mailbox) {
  const message = mailbox.selectedMessage;

  if (!message) {
    return `
      <div class="empty-inline">
        Select an email to read it here.
      </div>
    `;
  }

  return `
    <article class="mail-message">
      <div class="mail-message-head">
        <h3>${escapeHtml(message.subject || "(No subject)")}</h3>
        <span>${escapeHtml(formatDate(message.date || message.internalDate || ""))}</span>
      </div>
      <div class="mail-message-meta">
        <span><strong>From:</strong> ${escapeHtml(message.from || "Unknown")}</span>
        <span><strong>To:</strong> ${escapeHtml(message.to || "Unknown")}</span>
      </div>
      <div class="mail-message-body">
        <pre>${escapeHtml(message.textBody || message.htmlBody || message.snippet || "No readable message body found.")}</pre>
      </div>
    </article>
  `;
}

function renderComposeRecommendation(compose = {}) {
  if (compose.aiLoading) {
    return `<div class="compose-ai-card">Reading the draft and looking for improvements...</div>`;
  }

  if (compose.aiError) {
    return `<div class="compose-ai-card compose-ai-card--danger">${escapeHtml(compose.aiError)}</div>`;
  }

  if (compose.aiRecommendation) {
    return `
      <div class="compose-ai-card">
        ${escapeHtml(compose.aiRecommendation).replace(/\n/g, "<br />")}
      </div>
    `;
  }

  return `<div class="compose-ai-card compose-ai-card--muted">AI suggestions will appear here as you draft.</div>`;
}

function renderComposePanel(mailbox) {
  const compose = mailbox.compose || {};
  return `
    <form id="gmail-compose-form" class="mail-compose">
      <div class="mail-compose-head">
        <div>
          <span class="eyebrow">New Message</span>
          <h3>${escapeHtml(mailbox.emailAddress || "Team Mailbox")}</h3>
        </div>
        <button type="button" class="ghost-button ghost-button--compact" data-action="run-compose-ai" ${
          compose.aiLoading ? "disabled" : ""
        }>
          ${compose.aiLoading ? "Reviewing..." : "AI Review"}
        </button>
      </div>
      <div class="gmail-compose-fields">
        <label>
          <span>To</span>
          <input name="to" type="email" placeholder="partner@company.com" value="${escapeHtml(compose.to || "")}" required />
        </label>
        <label>
          <span>Subject</span>
          <input name="subject" placeholder="Partnership update from Atomic" value="${escapeHtml(compose.subject || "")}" required />
        </label>
        <textarea name="htmlBody" rows="12" placeholder="Hi James,&#10;&#10;I’m reaching out from Atomic..." required>${escapeHtml(
          compose.htmlBody || ""
        )}</textarea>
      </div>
      <aside class="compose-ai">
        <div class="compose-ai__head">
          <span class="eyebrow">AI Draft Coach</span>
          <small>Clarity, tone, next step</small>
        </div>
        ${renderComposeRecommendation(compose)}
      </aside>
      <div class="mail-compose-footer">
        <span class="mail-compose-note">Plain text or pasted HTML both work.</span>
        <button type="submit" class="primary-button">
          Send
        </button>
      </div>
    </form>
  `;
}

export function renderMailboxView({ mailbox }) {
  const canConnect = mailbox.connectEnabled !== false;
  return `
    <section id="mailbox" class="section-block">
      ${renderMailboxHeader(mailbox)}
      ${
        mailbox.connected
          ? `
            <div class="mailbox-status-row">
              <span class="badge badge--accent">Connected</span>
              <span class="mailbox-status-text">${escapeHtml(mailbox.emailAddress || "Gmail connected")}</span>
            </div>
            ${mailbox.error ? `<div class="inline-message inline-message--danger">${escapeHtml(mailbox.error)}</div>` : ""}
            <div class="gmail-toolbar panel">
              <form id="mailbox-search-form" class="mailbox-search">
                <label class="field">
                  <span>Search mail</span>
                  <input name="query" value="${escapeHtml(mailbox.query)}" placeholder="from:company.com or proposal" />
                </label>
                <button type="submit" class="ghost-button">Search</button>
              </form>
            </div>
            <div class="mailbox-grid gmail-layout">
              <article class="panel gmail-list-panel">
                ${renderInboxList(mailbox)}
              </article>
              <div class="mailbox-stack">
                <article class="panel gmail-message-panel">
                  <div class="preview-head">
                    <span class="eyebrow">Message</span>
                    <h3>Conversation</h3>
                  </div>
                  ${renderSelectedMessage(mailbox)}
                </article>
                <article class="panel gmail-compose-panel">
                  ${renderComposePanel(mailbox)}
                </article>
              </div>
            </div>
          `
          : `
            <div class="panel mailbox-empty">
              <span class="eyebrow">Connect Gmail</span>
              <h3>Bring the team inbox into Atomic</h3>
              <p>
                Connect the shared Gmail account to read inbox messages and send outreach directly from this site.
              </p>
              ${
                mailbox.error
                  ? `<div class="inline-message inline-message--danger">${escapeHtml(mailbox.error)}</div>`
                  : ""
              }
              ${
                !canConnect
                  ? `<p class="mail-compose-note">Gmail connect is disabled until the server has valid Google OAuth settings.</p>`
                  : ""
              }
              <div class="mailbox-actions">
                ${
                  canConnect
                    ? `<a href="${escapeHtml(mailbox.connectUrl)}" class="primary-button">Connect Gmail</a>`
                    : `<button type="button" class="primary-button" disabled>Connect Gmail</button>`
                }
              </div>
            </div>
          `
      }
    </section>
  `;
}
