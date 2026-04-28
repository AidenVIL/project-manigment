import { escapeHtml } from "../../utils/formatters.js";

function renderCheckRow(check, index) {
  return `
    <article class="panel scrut-check">
      <label class="scrut-check__head">
        <input type="checkbox" data-action="toggle-scrut-check" data-id="${escapeHtml(check.id)}" ${check.done ? "checked" : ""} />
        <strong>${index + 1}. ${escapeHtml(check.label)}</strong>
      </label>
      <textarea rows="2" placeholder="Notes / measurement / evidence" data-scrut-note="${escapeHtml(check.id)}">${escapeHtml(check.notes || "")}</textarea>
    </article>
  `;
}

function getCarStatus(car) {
  const checksDone = (car.checks || []).every((item) => item.done);
  const regs = car.regulations || [];
  const hasFail = regs.some((reg) => {
    const actual = Number(reg.actual);
    const hasActual = String(reg.actual).trim() !== "" && Number.isFinite(actual);
    if (!hasActual) return false;
    const minOk = reg.min === null || reg.min === undefined ? true : actual >= Number(reg.min);
    const maxOk = reg.max === null || reg.max === undefined ? true : actual <= Number(reg.max);
    return !(minOk && maxOk);
  });
  if (hasFail) return { label: "Fail", tone: "danger" };
  if (checksDone) return { label: "Pass", tone: "success" };
  return { label: "In Progress", tone: "warning" };
}

export function renderScrutineeringView(scrutState, activeCar) {
  const completeCount = (activeCar.checks || []).filter((item) => item.done).length;
  const total = (activeCar.checks || []).length;
  const progress = total ? Math.round((completeCount / total) * 100) : 0;

  const regulationRows = (activeCar.regulations || [])
    .map((reg) => {
      const actual = Number(reg.actual);
      const hasActual = String(reg.actual).trim() !== "" && Number.isFinite(actual);
      const minOk = reg.min === null || reg.min === undefined ? true : actual >= Number(reg.min);
      const maxOk = reg.max === null || reg.max === undefined ? true : actual <= Number(reg.max);
      const pass = hasActual ? minOk && maxOk : null;
      const status = pass === null ? "Pending" : pass ? "PASS" : "FAIL";
      const statusClass = pass === null ? "muted" : pass ? "success" : "danger";
      return `
        <tr>
          <td><input type="text" class="scrut-table-input" placeholder="Code" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="code" value="${escapeHtml(reg.code || "")}" /></td>
          <td><input type="text" class="scrut-table-input" placeholder="Measure" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="label" value="${escapeHtml(reg.label || "")}" /></td>
          <td><input type="number" class="scrut-table-input" step="any" placeholder="Min" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="min" value="${escapeHtml(String(reg.min ?? ""))}" /></td>
          <td><input type="number" class="scrut-table-input" step="any" placeholder="Max" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="max" value="${escapeHtml(String(reg.max ?? ""))}" /></td>
          <td><input type="text" class="scrut-table-input" placeholder="Unit" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="unit" value="${escapeHtml(reg.unit || "")}" /></td>
          <td><input type="number" class="scrut-table-input" step="any" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="actual" value="${escapeHtml(String(reg.actual ?? ""))}" /></td>
          <td><span class="badge badge--${statusClass}">${status}</span></td>
          <td><input type="text" class="scrut-table-input" placeholder="Penalty" data-scrut-reg-field="${escapeHtml(reg.id)}" data-scrut-field-name="penalty" value="${escapeHtml(reg.penalty || "")}" /></td>
          <td><button type="button" class="ghost-button ghost-button--compact" data-action="delete-scrut-rule" data-id="${escapeHtml(reg.id)}">Delete</button></td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Pre-Event Compliance</span>
          <h2>Scrutineering Checklist</h2>
        </div>
        <button type="button" class="primary-button" data-action="add-scrut-car">Add Car</button>
      </div>

      <div class="panel scrut-car-tabs">
        ${(scrutState.cars || [])
          .map((car) => {
            const status = getCarStatus(car);
            const isActive = car.id === activeCar.id;
            return `
              <button type="button" class="scrut-car-tab ${isActive ? "is-active" : ""}" data-action="select-scrut-car" data-id="${escapeHtml(car.id)}">
                <strong>${escapeHtml(car.name || "Car")}</strong>
                <span class="badge badge--${status.tone}">${status.label}</span>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="panel">
        <label class="field">
          <span>Active Car Name</span>
          <input id="scrut-car-name" value="${escapeHtml(activeCar.name || "")}" />
        </label>
      </div>

      <div class="toolbar-summary panel">
        <strong>${progress}%</strong>
        <span>${completeCount}/${total} complete</span>
      </div>

      <div class="scrut-grid">
        <section class="panel scrut-section">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Checklist</span>
              <h3>Inspection items</h3>
            </div>
          </div>
          <div class="scrut-checklist">
            ${(activeCar.checks || []).map((check, idx) => renderCheckRow(check, idx)).join("")}
          </div>
        </section>

        <article class="panel scrut-section">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Regulations Extract</span>
              <h3>Technical limits (SRWF26)</h3>
            </div>
            <button type="button" class="ghost-button" data-action="add-scrut-rule">Add Rule</button>
          </div>
          <div class="table-wrap">
            <table class="scrut-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Measure</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Unit</th>
                  <th>Actual</th>
                  <th>Status</th>
                  <th>Penalty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>${regulationRows}</tbody>
            </table>
          </div>
          <p class="editor-help">These checks were seeded from SRWF26 technical regulations and can be edited as needed.</p>
        </article>
      </div>
    </section>
  `;
}
