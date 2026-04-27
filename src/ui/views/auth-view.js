import { escapeHtml } from "../../utils/formatters.js";

export function renderAuthView({ config, loginError, mode = "login", setupUsername = "", supabaseConnection = {} }) {
  const isSetup = mode === "setup";
  const statusLabel =
    supabaseConnection.status === "ok"
      ? "Supabase connected"
      : supabaseConnection.status === "pending"
      ? "Checking Supabase"
      : supabaseConnection.status === "error"
      ? "Supabase error"
      : supabaseConnection.status === "missing"
      ? "Supabase not configured"
      : "Supabase status";
  const statusClass =
    supabaseConnection.status === "ok"
      ? "badge badge--success"
      : supabaseConnection.status === "pending"
      ? "badge badge--info"
      : supabaseConnection.status === "error"
      ? "badge badge--danger"
      : "badge badge--muted";

  return `
    <main class="auth-page">
      <section class="auth-panel">
        <div class="auth-copy">
          <div class="auth-logo-wrap">
            <img src="${escapeHtml(config.logoPath)}" alt="${escapeHtml(config.teamName)} logo" class="auth-logo" />
          </div>
          <span class="eyebrow">Teammate Access</span>
          <h1>${escapeHtml(config.teamName)}</h1>
          <p>
            ${
              isSetup
                ? "First login detected. Set a password for your username to finish account setup."
                : "Log in with your username and password to open the sponsor workspace."
            }
          </p>
          <ul class="auth-points">
            <li>Shared sponsor database via Supabase</li>
            <li>Deployable static frontend on Render</li>
            <li>Editable HTML email templates with company tokens</li>
          </ul>
        </div>
        <form id="login-form" class="auth-form">
          <input type="hidden" name="mode" value="${isSetup ? "setup" : "login"}" />
          ${
            supabaseConnection.status && supabaseConnection.status !== "idle"
              ? `
                <div class="auth-status-row">
                  <span class="${statusClass}">${escapeHtml(statusLabel)}</span>
                  <span class="auth-status-description">${escapeHtml(
                    supabaseConnection.message || "Supabase connection status is unavailable."
                  )}</span>
                </div>
              `
              : ""
          }
          <label class="field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              value="${escapeHtml(setupUsername)}"
              ${isSetup ? "readonly" : "required"}
            />
          </label>
          ${
            isSetup
              ? `
                <label class="field">
                  <span>Set Password</span>
                  <input type="password" name="newPassword" placeholder="Create a password" required />
                </label>
                <label class="field">
                  <span>Confirm Password</span>
                  <input type="password" name="confirmPassword" placeholder="Re-enter password" required />
                </label>
              `
              : `
                <label class="field">
                  <span>Password</span>
                  <input type="password" name="password" placeholder="Enter your password" required />
                </label>
              `
          }
          ${
            loginError
              ? `<div class="inline-message inline-message--danger">${escapeHtml(loginError)}</div>`
              : ""
          }
          <button type="submit" class="primary-button primary-button--full">
            ${isSetup ? "Save Password and Continue" : "Unlock Workspace"}
          </button>
          <p class="auth-footnote">
            User accounts can be pre-added by username. First login requires password setup.
          </p>
        </form>
      </section>
    </main>
  `;
}
