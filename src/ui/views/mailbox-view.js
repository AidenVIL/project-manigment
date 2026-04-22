import { escapeHtml, formatDate } from "../../utils/formatters.js";

function renderMailboxHeader(mailbox) {
  return `
    <div class="section-header">
      <div>
        <span class="eyebrow">Team Mailbox</span>
        <h2>Inbox & Sending</h2>
      </div>
      <div class="mailbox-actions">
        ${
          mailbox.connected
            ? `
              <button type="button" class="ghost-button" data-action="refresh-mailbox">Refresh</button>
              <button type="button" class="ghost-button ghost-button--danger" data-action="disconnect-gmail">Disconnect</button>
            `
            : `
              <a href="${escapeHtml(mailbox.connectUrl)}" class="primary-button">Connect Gmail</a>
            `
        }
      </div>
    </div>
  `;
}

function renderInboxList(mailbox) {
  if (mailbox.loading) {
    return `<div class="empty-inline">Loading inbox...</div>`;
  }

  if (!mailbox.messages.length) {
    return `<div class="empty-inline">No messages found for this search.</div>`;
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
              <strong>${escapeHtml(message.subject || "(No subject)")}</strong>
              <span>${escapeHtml(message.from || "Unknown sender")}</span>
              <small>${escapeHtml(message.snippet || "")}</small>
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
        Select an email from the inbox to read it here.
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

function renderComposePanel(mailbox) {
  return `
    <form id="gmail-compose-form" class="mail-compose">
      <div class="mail-compose-head">
        <div>
          <span class="eyebrow">Compose</span>
          <h3>Send From ${escapeHtml(mailbox.emailAddress || "Team Mailbox")}</h3>
        </div>
      </div>
      <label class="field">
        <span>To</span>
        <input name="to" type="email" placeholder="partner@company.com" required />
      </label>
      <label class="field">
        <span>Subject</span>
        <input name="subject" placeholder="Partnership update from Atomic" required />
      </label>
      <label class="field">
        <span>Message Body</span>
        <textarea name="htmlBody" rows="12" placeholder="<p>Hi James,</p><p>...</p>" required></textarea>
      </label>
      <p class="mail-compose-note">
        This field accepts HTML, so you can paste in template output from the email editor.
      </p>
      <button type="submit" class="primary-button">
        Send Email
      </button>
    </form>
  `;
}

export function renderMailboxView({ mailbox }) {
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
            <div class="mailbox-grid">
              <article class="panel">
                <form id="mailbox-search-form" class="mailbox-search">
                  <label class="field">
                    <span>Search Inbox</span>
                    <input name="query" value="${escapeHtml(mailbox.query)}" placeholder="from:company.com or proposal" />
                  </label>
                  <button type="submit" class="ghost-button">Search</button>
                </form>
                ${renderInboxList(mailbox)}
              </article>
              <div class="mailbox-stack">
                <article class="panel">
                  <div class="preview-head">
                    <span class="eyebrow">Selected Message</span>
                    <h3>Inbox Detail</h3>
                  </div>
                  ${renderSelectedMessage(mailbox)}
                </article>
                <article class="panel">
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
              <div class="mailbox-actions">
                <a href="${escapeHtml(mailbox.connectUrl)}" class="primary-button">Connect Gmail</a>
              </div>
            </div>
          `
      }
    </section>
  `;
}
