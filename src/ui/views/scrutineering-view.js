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

  const tol = activeCar.tolerance;
  const toleranceDelta = Number(tol.actual || 0) - Number(tol.nominal || 0);
  const tolerancePass = Math.abs(toleranceDelta) <= Number(tol.plusMinus || 0);

  const density = activeCar.density;
  const densityValue =
    Number(density.volumeMm3 || 0) > 0
      ? (Number(density.massG || 0) / Number(density.volumeMm3 || 0)).toFixed(6)
      : "0.000000";

  const regulationRows = (activeCar.regulations || [])
    .map((reg) => {
      const actual = Number(reg.actual);
      const hasActual = String(reg.actual).trim() !== "" && Number.isFinite(actual);
      const minOk = reg.min === null || reg.min === undefined ? true : actual >= Number(reg.min);
      const maxOk = reg.max === null || reg.max === undefined ? true : actual <= Number(reg.max);
      const pass = hasActual ? minOk && maxOk : null;
      const status = pass === null ? "Pending" : pass ? "PASS" : "FAIL";
      const statusClass = pass === null ? "muted" : pass ? "success" : "danger";
      const limits = `${reg.min ?? "-"} to ${reg.max ?? "-"}`;
      return `
        <tr>
          <td><strong>${escapeHtml(reg.code)}</strong></td>
          <td>${escapeHtml(reg.label)}</td>
          <td>${escapeHtml(limits)} ${escapeHtml(reg.unit || "")}</td>
          <td><input type="number" step="any" data-scrut-reg="${escapeHtml(reg.id)}" value="${escapeHtml(String(reg.actual ?? ""))}" /></td>
          <td><span class="badge badge--${statusClass}">${status}</span></td>
          <td>${escapeHtml(reg.penalty || "-")}</td>
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
        <div class="scrut-left">
          ${(activeCar.checks || []).map((check, idx) => renderCheckRow(check, idx)).join("")}
        </div>
        <div class="scrut-right">
          <article class="panel">
            <span class="eyebrow">Regulations Extract</span>
            <h3>Technical limits (SRWF26)</h3>
            <div class="table-wrap">
              <table class="scrut-table">
                <thead>
                  <tr><th>Rule</th><th>Measure</th><th>Limits</th><th>Actual</th><th>Status</th><th>Penalty</th></tr>
                </thead>
                <tbody>${regulationRows}</tbody>
              </table>
            </div>
            <p class="editor-help">These checks were seeded from SRWF26 technical regulations (expand as needed).</p>
          </article>

          <article class="panel">
            <span class="eyebrow">Engineering Helper</span>
            <h3>Tolerance Check</h3>
            <div class="form-grid">
              <label class="field"><span>Nominal</span><input type="number" step="any" data-scrut-field="tolerance.nominal" value="${tol.nominal}" /></label>
              <label class="field"><span>Actual</span><input type="number" step="any" data-scrut-field="tolerance.actual" value="${tol.actual}" /></label>
              <label class="field"><span>+/- Tolerance</span><input type="number" step="any" data-scrut-field="tolerance.plusMinus" value="${tol.plusMinus}" /></label>
            </div>
            <p class="editor-help">Delta: <strong>${toleranceDelta.toFixed(4)}</strong> | Result: <strong>${tolerancePass ? "PASS" : "FAIL"}</strong></p>
          </article>

          <article class="panel">
            <span class="eyebrow">Engineering Helper</span>
            <h3>Density Estimate</h3>
            <div class="form-grid">
              <label class="field"><span>Mass (g)</span><input type="number" step="any" data-scrut-field="density.massG" value="${density.massG}" /></label>
              <label class="field"><span>Volume (mm³)</span><input type="number" step="any" data-scrut-field="density.volumeMm3" value="${density.volumeMm3}" /></label>
            </div>
            <p class="editor-help">Density (g/mm³): <strong>${escapeHtml(densityValue)}</strong></p>
          </article>
        </div>
      </div>
    </section>
  `;
}

