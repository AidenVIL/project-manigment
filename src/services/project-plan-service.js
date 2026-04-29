import { STORAGE_KEYS, storageService } from "./storage-service.js";

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const seedPlan = {
  projectName: "Atomic 2026 Project Timeline",
  assessmentGoal: "Assessment-ready plan covering research, design, manufacture, testing, communication, and final presentation.",
  tasks: [
    {
      id: "plan-research",
      title: "Research regulations and judge criteria",
      phase: "Research",
      owner: "Engineering",
      startDate: shiftDate(-7),
      endDate: shiftDate(3),
      progress: 100,
      milestone: false,
      markSchemeFocus: "Research and planning",
      notes: "Capture rule limits, event deadlines, and assessment evidence needed."
    },
    {
      id: "plan-concepts",
      title: "Concept generation and shortlist",
      phase: "Design",
      owner: "Design",
      startDate: shiftDate(0),
      endDate: shiftDate(10),
      progress: 70,
      milestone: false,
      markSchemeFocus: "Creativity and justification",
      notes: "Compare concepts and record why the selected route is strongest."
    },
    {
      id: "plan-cad",
      title: "Final CAD development",
      phase: "Design",
      owner: "CAD",
      startDate: shiftDate(8),
      endDate: shiftDate(22),
      progress: 42,
      milestone: false,
      markSchemeFocus: "CAD quality and development",
      notes: "Show revisions and design decisions, not just final screenshots."
    },
    {
      id: "plan-branding",
      title: "Branding and portfolio layout",
      phase: "Communication",
      owner: "Branding",
      startDate: shiftDate(6),
      endDate: shiftDate(20),
      progress: 30,
      milestone: false,
      markSchemeFocus: "Brand identity and communication",
      notes: "Keep visual identity consistent across cards, slides, and documents."
    },
    {
      id: "plan-manufacture",
      title: "Manufacture prototype and race car",
      phase: "Manufacture",
      owner: "Workshop",
      startDate: shiftDate(18),
      endDate: shiftDate(31),
      progress: 18,
      milestone: false,
      markSchemeFocus: "Manufacturing quality",
      notes: "Track materials, tolerances, and process evidence."
    },
    {
      id: "plan-testing",
      title: "Testing, iteration, and evaluation",
      phase: "Testing",
      owner: "Performance",
      startDate: shiftDate(24),
      endDate: shiftDate(38),
      progress: 12,
      milestone: false,
      markSchemeFocus: "Testing and evaluation",
      notes: "Log changes made because of the data you collect."
    },
    {
      id: "plan-portfolio",
      title: "Portfolio final evidence pass",
      phase: "Submission",
      owner: "Portfolio",
      startDate: shiftDate(34),
      endDate: shiftDate(43),
      progress: 0,
      milestone: false,
      markSchemeFocus: "Evidence quality and structure",
      notes: "Make sure every section shows process, not just final outcomes."
    },
    {
      id: "plan-presentation",
      title: "Final presentation and hand-in",
      phase: "Submission",
      owner: "Team",
      startDate: shiftDate(44),
      endDate: shiftDate(44),
      progress: 0,
      milestone: true,
      markSchemeFocus: "Presentation and delivery",
      notes: "Submission milestone."
    }
  ]
};

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function normalizeProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeTask(task = {}, index = 0) {
  const startDate = normalizeDate(task.startDate) || shiftDate(index * 3);
  const endDate = normalizeDate(task.endDate) || startDate;
  return {
    id: String(task.id || crypto.randomUUID()),
    title: String(task.title || "New task").trim(),
    phase: String(task.phase || "Planning").trim(),
    owner: String(task.owner || "Team").trim(),
    startDate,
    endDate,
    progress: normalizeProgress(task.progress),
    milestone: Boolean(task.milestone),
    markSchemeFocus: String(task.markSchemeFocus || "General evidence").trim(),
    notes: String(task.notes || "").trim()
  };
}

function normalizePlan(input = {}) {
  const tasks = Array.isArray(input.tasks) ? input.tasks.map(normalizeTask) : seedPlan.tasks.map(normalizeTask);
  return {
    projectName: String(input.projectName || seedPlan.projectName).trim(),
    assessmentGoal: String(input.assessmentGoal || seedPlan.assessmentGoal).trim(),
    tasks: tasks.sort((left, right) => {
      const leftTime = new Date(left.startDate).getTime();
      const rightTime = new Date(right.startDate).getTime();
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
      return safeLeft - safeRight;
    })
  };
}

export const projectPlanService = {
  loadPlan() {
    const stored = storageService.read(STORAGE_KEYS.projectPlan, null);
    if (stored) {
      return normalizePlan(stored);
    }

    const plan = normalizePlan(seedPlan);
    storageService.write(STORAGE_KEYS.projectPlan, plan);
    return plan;
  },
  savePlan(plan) {
    const normalized = normalizePlan(plan);
    storageService.write(STORAGE_KEYS.projectPlan, normalized);
    return normalized;
  }
};
