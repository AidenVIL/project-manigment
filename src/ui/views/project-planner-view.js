import { escapeHtml, formatDate } from "../../utils/formatters.js";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

function diffInDays(left, right) {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function buildTimeline(tasks = []) {
  const validTasks = tasks.filter((task) => toDate(task.startDate) && toDate(task.endDate));
  const fallback = new Date();
  const minDate = validTasks.length
    ? validTasks.reduce((min, task) => {
        const current = toDate(task.startDate);
        return current < min ? current : min;
      }, toDate(validTasks[0].startDate))
    : fallback;
  const maxDate = validTasks.length
    ? validTasks.reduce((max, task) => {
        const current = toDate(task.endDate);
        return current > max ? current : max;
      }, toDate(validTasks[0].endDate))
    : fallback;

  const rangeStart = startOfWeek(minDate || fallback);
  const rangeEnd = endOfWeek(maxDate || fallback);
  const weeks = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    weeks.push({
      key: cursor.toISOString().slice(0, 10),
      start: new Date(cursor),
      end: endOfWeek(cursor)
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return { rangeStart, rangeEnd, weeks };
}

function renderSummary(plan = {}) {
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const milestoneCount = tasks.filter((task) => task.milestone).length;
  const completedCount = tasks.filter((task) => Number(task.progress) >= 100).length;
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / tasks.length)
    : 0;
  const coverage = [...new Set(tasks.map((task) => String(task.markSchemeFocus || "").trim()).filter(Boolean))];

  return `
    <div class="stats-grid stats-grid--compact">
      <article class="stat-card panel">
        <span>Tasks</span>
        <strong>${tasks.length}</strong>
        <small>Editable work items</small>
      </article>
      <article class="stat-card panel">
        <span>Milestones</span>
        <strong>${milestoneCount}</strong>
        <small>Submission points</small>
      </article>
      <article class="stat-card panel">
        <span>Completed</span>
        <strong>${completedCount}</strong>
        <small>100% finished items</small>
      </article>
      <article class="stat-card panel">
        <span>Average Progress</span>
        <strong>${avgProgress}%</strong>
        <small>Across the full plan</small>
      </article>
    </div>
    <article class="panel gantt-coverage-panel">
      <div class="section-header">
        <div>
          <span class="eyebrow">Mark Scheme Coverage</span>
          <h2>Assessment focus built into the plan</h2>
        </div>
      </div>
      <p class="muted-copy">${escapeHtml(plan.assessmentGoal || "")}</p>
      <div class="gantt-coverage-list">
        ${coverage.length
          ? coverage.map((item) => `<span class="badge badge--outline">${escapeHtml(item)}</span>`).join("")
          : `<span class="badge badge--outline">Add tasks to show coverage</span>`}
      </div>
    </article>
  `;
}

function renderTaskTable(tasks = []) {
  if (!tasks.length) {
    return `
      <div class="panel empty-state">
        <h3>No tasks yet</h3>
        <p>Add your first task and the chart will build itself underneath.</p>
      </div>
    `;
  }

  return `
    <div class="panel gantt-table-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Task Builder</span>
          <h3>Project tasks</h3>
        </div>
        <button type="button" class="primary-button" data-action="add-gantt-task">Add Task</button>
      </div>
      <div class="table-wrap">
        <table class="gantt-task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Phase</th>
              <th>Owner</th>
              <th>Start</th>
              <th>End</th>
              <th>%</th>
              <th>Milestone</th>
              <th>Mark Scheme Focus</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${tasks
              .map(
                (task) => `
                  <tr>
                    <td><input data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="title" value="${escapeHtml(task.title)}" /></td>
                    <td><input data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="phase" value="${escapeHtml(task.phase)}" /></td>
                    <td><input data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="owner" value="${escapeHtml(task.owner)}" /></td>
                    <td><input type="date" data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="startDate" value="${escapeHtml(task.startDate)}" /></td>
                    <td><input type="date" data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="endDate" value="${escapeHtml(task.endDate)}" /></td>
                    <td><input type="number" min="0" max="100" step="1" data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="progress" value="${escapeHtml(String(task.progress))}" /></td>
                    <td class="gantt-task-table__checkbox">
                      <input type="checkbox" data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="milestone" ${task.milestone ? "checked" : ""} />
                    </td>
                    <td><input data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="markSchemeFocus" value="${escapeHtml(task.markSchemeFocus)}" /></td>
                    <td><input data-gantt-task-id="${escapeHtml(task.id)}" data-gantt-field="notes" value="${escapeHtml(task.notes)}" /></td>
                    <td><button type="button" class="ghost-button ghost-button--compact" data-action="delete-gantt-task" data-id="${escapeHtml(task.id)}">Delete</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderChart(tasks = []) {
  const timeline = buildTimeline(tasks);
  const weekCount = Math.max(timeline.weeks.length, 1);
  const chartGridStyle = `grid-template-columns: 260px repeat(${weekCount}, minmax(54px, 1fr));`;

  return `
    <div class="panel gantt-chart-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">Gantt Chart</span>
          <h3>Live schedule view</h3>
        </div>
        <span class="badge badge--outline">${escapeHtml(formatDate(timeline.rangeStart))} to ${escapeHtml(formatDate(timeline.rangeEnd))}</span>
      </div>
      <div class="gantt-chart">
        <div class="gantt-chart__grid gantt-chart__grid--header" style="${chartGridStyle}">
          <div class="gantt-chart__task-head">Task</div>
          ${timeline.weeks
            .map(
              (week) => `
                <div class="gantt-chart__week-head">
                  <strong>${escapeHtml(formatDate(week.start))}</strong>
                  <span>${escapeHtml(formatDate(week.end))}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="gantt-chart__body">
          ${tasks
            .map((task) => {
              const start = toDate(task.startDate) || timeline.rangeStart;
              const end = toDate(task.endDate) || start;
              const startWeek = Math.max(1, Math.floor(diffInDays(startOfWeek(start), timeline.rangeStart) / 7) + 1);
              const endWeek = Math.max(startWeek, Math.floor(diffInDays(startOfWeek(end), timeline.rangeStart) / 7) + 1);
              const span = Math.max(1, endWeek - startWeek + 1);
              const progress = Math.max(0, Math.min(100, Number(task.progress || 0)));
              return `
                <div class="gantt-chart__grid gantt-chart__row" style="${chartGridStyle}">
                  <div class="gantt-chart__task-meta">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span>${escapeHtml(task.phase)} · ${escapeHtml(task.owner)}</span>
                    <small>${escapeHtml(task.markSchemeFocus)}</small>
                  </div>
                  ${timeline.weeks.map(() => `<div class="gantt-chart__cell"></div>`).join("")}
                  <div
                    class="gantt-bar ${task.milestone ? "gantt-bar--milestone" : ""}"
                    style="grid-column:${startWeek + 1} / span ${span};"
                  >
                    <span class="gantt-bar__fill" style="width:${progress}%"></span>
                    <strong>${task.milestone ? "Milestone" : `${progress}%`}</strong>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

export function renderProjectPlannerView(plan = {}) {
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];

  return `
    <section class="section-block" id="planner">
      <div class="section-header">
        <div>
          <span class="eyebrow">Project Planning</span>
          <h2>Gantt Chart Maker</h2>
        </div>
        <button type="button" class="primary-button" data-action="add-gantt-task">Add Task</button>
      </div>

      <article class="panel gantt-meta-panel">
        <div class="form-grid form-grid--compact">
          <label class="field">
            <span>Project Title</span>
            <input data-gantt-meta="projectName" value="${escapeHtml(plan.projectName || "")}" />
          </label>
          <label class="field">
            <span>Assessment Goal</span>
            <input data-gantt-meta="assessmentGoal" value="${escapeHtml(plan.assessmentGoal || "")}" />
          </label>
        </div>
      </article>

      ${renderSummary(plan)}
      ${renderTaskTable(tasks)}
      ${renderChart(tasks)}
    </section>
  `;
}
