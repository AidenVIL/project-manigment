import { escapeHtml } from "../../utils/formatters.js";

export function renderThankYouCardsView(model) {
  return `
    <section class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Atomic Branding</span>
          <h2>GoFundMe Thank You Cards</h2>
        </div>
        <button type="button" class="primary-button" data-action="download-thankyou-png">Save PNG</button>
      </div>
      <div class="thanks-grid">
        <article class="panel">
          <div class="form-grid">
            <label class="field">
              <span>Name</span>
              <input data-thanks-field="recipientName" value="${escapeHtml(model.recipientName)}" placeholder="Supporter name" />
            </label>
            <label class="field">
              <span>Amount</span>
              <input data-thanks-field="donationAmount" value="${escapeHtml(model.donationAmount)}" placeholder="e.g. £25" />
            </label>
            <label class="field field--span-2">
              <span>Message</span>
              <textarea rows="4" data-thanks-field="message">${escapeHtml(model.message)}</textarea>
            </label>
            <label class="field">
              <span>From Team Member</span>
              <input data-thanks-field="fromName" value="${escapeHtml(model.fromName)}" placeholder="Your name" />
            </label>
            <label class="field">
              <span>Role</span>
              <input data-thanks-field="fromRole" value="${escapeHtml(model.fromRole)}" placeholder="Team role" />
            </label>
          </div>
        </article>
        <article class="panel">
          <div class="thanks-preview-wrap">
            <canvas id="thankyou-card-canvas" width="1200" height="675"></canvas>
          </div>
          <p class="editor-help">Landscape PNG (1200x675) with Atomic styling. Great for socials and direct messages.</p>
        </article>
      </div>
    </section>
  `;
}

