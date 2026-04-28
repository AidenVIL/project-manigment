import { escapeHtml } from "../../utils/formatters.js";

function renderCheckRow(check, index) {
  return `
    <article class="panel scrut-check">
      <label class="scrut-check__head">
        <input type="checkbox" data-action="toggle-scrut-check" data-id="${escapeHtml(check.id)}" ${check.done ? "checked" : ""} />
        <strong>${index + 1}. ${escapeHtml(check.label)}</strong>
      </label>
      <textarea
        rows="2"
        placeholder="Notes / measurement / evidence"
        data-scrut-note="${escapeHtml(check.id)}"
      >${escapeHtml(check.notes || "")}</textarea>
    </article>
  `;
}

export function renderScrutineeringView(scrut) {
  const completeCount = scrut.checks.filter((item) => item.done).length;
  const total = scrut.checks.length;
  const progress = total ? Math.round((completeCount / total) * 100) : 0;

  const tol = scrut.tolerance;
  const toleranceDelta = Number(tol.actual || 0) - Number(tol.nominal || 0);
  const tolerancePass = Math.abs(toleranceDelta) <= Number(tol.plusMinus || 0);

  const density = scrut.density;
  const densityValue =
    Number(density.volumeMm3 || 0) > 0
      ? (Number(density.massG || 0) / Number(density.volumeMm3 || 0)).toFixed(6)
      : "0.000000";

  return `
    <section class="section-block">
      <div class="section-header">
        <div>
          <span class="eyebrow">Pre-Event Compliance</span>
          <h2>Scrutineering Checklist</h2>
        </div>
        <div class="toolbar-summary">
          <strong>${progress}%</strong>
          <span>${completeCount}/${total} complete</span>
        </div>
      </div>

      <div class="scrut-grid">
        <div class="scrut-left">
          ${scrut.checks.map((check, idx) => renderCheckRow(check, idx)).join("")}
        </div>
        <div class="scrut-right">
          <article class="panel">
            <span class="eyebrow">Engineering Helper</span>
            <h3>Tolerance Check</h3>
            <div class="form-grid">
              <label class="field">
                <span>Nominal</span>
                <input type="number" step="any" data-scrut-field="tolerance.nominal" value="${tol.nominal}" />
              </label>
              <label class="field">
                <span>Actual</span>
                <input type="number" step="any" data-scrut-field="tolerance.actual" value="${tol.actual}" />
              </label>
              <label class="field">
                <span>+/- Tolerance</span>
                <input type="number" step="any" data-scrut-field="tolerance.plusMinus" value="${tol.plusMinus}" />
              </label>
            </div>
            <p class="editor-help">
              Delta: <strong>${toleranceDelta.toFixed(4)}</strong> |
              Result: <strong>${tolerancePass ? "PASS" : "FAIL"}</strong>
            </p>
          </article>

          <article class="panel">
            <span class="eyebrow">Engineering Helper</span>
            <h3>Density Estimate</h3>
            <div class="form-grid">
              <label class="field">
                <span>Mass (g)</span>
                <input type="number" step="any" data-scrut-field="density.massG" value="${density.massG}" />
              </label>
              <label class="field">
                <span>Volume (mm³)</span>
                <input type="number" step="any" data-scrut-field="density.volumeMm3" value="${density.volumeMm3}" />
              </label>
            </div>
            <p class="editor-help">Density (g/mm³): <strong>${escapeHtml(densityValue)}</strong></p>
          </article>

          <article class="panel">
            <span class="eyebrow">Quick Guidance</span>
            <h3>What helps in scrutineering</h3>
            <ul class="insight-list">
              <li>Record measured values and tool used (caliper/scale).</li>
              <li>Capture evidence photos for key checks (axles, cartridge area, aero).</li>
              <li>Keep a final “race-ready” config and avoid late geometry changes.</li>
              <li>Pre-check all rule-critical dimensions with a second teammate.</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  `;
}

