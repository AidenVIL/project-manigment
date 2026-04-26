import { escapeHtml } from "../../utils/formatters.js";

function renderUserStatePill(user) {
  if (!user.isActive) {
    return `<span class="badge badge--muted">Inactive</span>`;
  }

  if (user.mustSetPassword) {
    return `<span class="badge badge--warning">Needs password setup</span>`;
  }

  return `<span class="badge badge--success">Active</span>`;
}

export function renderAccountsView({ users = [], loading = false, error = "", canManage = false }) {
  const rows = users.length
    ? users
        .map(
          (user) => `
            <article class="company-card panel">
              <div class="company-card-top">
                <div>
                  <h3>${escapeHtml(user.username)}</h3>
                  <p>${escapeHtml(user.role || "member")}</p>
                </div>
                <div class="company-actions">
                  ${renderUserStatePill(user)}
                  ${
                    canManage
                      ? `
                        <button
                          type="button"
                          class="ghost-button"
                          data-action="reset-user-password"
                          data-id="${escapeHtml(user.username)}"
                        >
                          Force Reset
                        </button>
                      `
                      : ""
                  }
                </div>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="panel empty-state"><h3>No accounts yet</h3><p>Add usernames to pre-provision team access.</p></div>`;

  return `
    <section class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Access</span>
          <h2>User Accounts</h2>
        </div>
      </div>
      <div class="panel">
        <form id="add-account-form" class="toolbar">
          <label class="toolbar-field">
            <span>New username</span>
            <input name="username" placeholder="jane.smith" required />
          </label>
          <div class="toolbar-field">
            <span>Role</span>
            <select name="role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="toolbar-field">
            <span>Action</span>
            <button type="submit" class="primary-button primary-button--full" ${canManage ? "" : "disabled"}>
              Add Username
            </button>
          </div>
          <div class="toolbar-summary">
            <strong>${users.length}</strong>
            <span>Total accounts</span>
          </div>
        </form>
        ${
          error
            ? `<div class="inline-message inline-message--danger" style="margin-top:1rem;">${escapeHtml(error)}</div>`
            : ""
        }
        <p class="finder-help" style="margin-top:1rem;">
          Add usernames here. On first login, each person will be prompted to set their own password.
        </p>
      </div>
      ${
        loading
          ? `<div class="panel empty-state"><p>Loading accounts...</p></div>`
          : `<div class="company-grid">${rows}</div>`
      }
    </section>
  `;
}
