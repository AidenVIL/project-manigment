import { escapeHtml } from "../../utils/formatters.js";

export function renderAuthView({ config, loginError }) {
  return `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-copy">
          <span class="eyebrow">Teammate Access</span>
          <h1>${escapeHtml(config.teamName)}</h1>
          <p>
            Enter the shared team password to open the sponsor workspace and manage outreach,
            follow-up dates, and email templates from one place.
          </p>
          <ul class="auth-points">
            <li>Shared sponsor database via Supabase</li>
            <li>Deployable static frontend on Render</li>
            <li>Editable HTML email templates with company tokens</li>
          </ul>
        </div>
        <form id="login-form" class="auth-form">
          <label class="field">
            <span>Shared Password</span>
            <input type="password" name="password" placeholder="Enter team password" required />
          </label>
          ${
            loginError
              ? `<div class="inline-message inline-message--danger">${escapeHtml(loginError)}</div>`
              : ""
          }
          <button type="submit" class="primary-button primary-button--full">Unlock Workspace</button>
          <p class="auth-footnote">
            Mk 1 uses one shared password in the frontend config. It is easy to use, but it is not
            strong security for sensitive data.
          </p>
        </form>
      </section>
    </main>
  `;
}
