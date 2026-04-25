import { APP_CONFIG, isSupabaseConfigured } from "./config/runtime-config.js";
import { askTypeOptions, createCompany, getOptionLabel } from "./models/company-model.js";
import { authService } from "./services/auth-service.js";
import {
  buildCalendarEvents,
  buildCalendarMonthView,
  buildCalendarSummary
} from "./services/calendar-service.js";
import { companyService } from "./services/company-service.js";
import { buildDashboardSnapshot } from "./services/dashboard-service.js";
import { draftService } from "./services/draft-service.js";
import { gmailService } from "./services/gmail-service.js";
import { companyResearchService } from "./services/company-research-service.js";
import { templateService } from "./services/template-service.js";
import { analyzeEmailWriting } from "./services/writing-coach-service.js";
import { renderCompanyModal } from "./ui/components/modal.js";
import { renderFollowUpWorkflowModal } from "./ui/components/follow-up-workflow-modal.js";
import { renderAuthView } from "./ui/views/auth-view.js";
import { renderCalendarView } from "./ui/views/calendar-view.js";
import { renderCompaniesView } from "./ui/views/companies-view.js";
import { renderDashboardView } from "./ui/views/dashboard-view.js";
import { renderMailboxView } from "./ui/views/mailbox-view.js";
import { renderTemplateEditorView } from "./ui/views/template-editor-view.js";
import { renderEmailStudioView } from "./ui/views/template-hub-view.js";
import { addDaysToInputDate } from "./utils/date-utils.js";
import { escapeHtml } from "./utils/formatters.js";

const root = document.querySelector("#app");

const PREVIEW_COMPANY = createCompany({
  id: "preview-company",
  companyName: "Preview Company",
  contactName: "Alex Partner",
  contactEmail: "hello@example.com",
  askType: "cash",
  askValue: 5000,
  nextFollowUp: new Date().toISOString().slice(0, 10)
});

const state = {
  loading: true,
  loginError: "",
  companies: [],
  templates: [],
  drafts: [],
  filters: {
    search: "",
    status: "all"
  },
  modal: {
    open: false,
    companyId: "",
    draft: createCompany(),
    saving: false,
    error: "",
    researchLoading: false,
    researchError: "",
    researchResult: null,
    researchMode: "website",
    completedResearchEntries: []
  },
  mailbox: {
    loading: false,
    connected: false,
    connectUrl: gmailService.getConnectUrl(),
    emailAddress: "",
    query: "",
    messages: [],
    selectedMessageId: "",
    selectedMessage: null,
    error: ""
  },
  calendar: {
    referenceDate: new Date().toISOString().slice(0, 10),
    workflow: {
      open: false,
      eventId: "",
      selectedTemplateId: "",
      sending: false,
      error: ""
    }
  },
  preferredCompanyId: "",
  editor: null,
  toast: ""
};

let toastTimer = null;
let shouldRestoreEditorFocus = false;
let currentEditorDrag = null;
let activeDropZone = null;
let currentLayoutDrag = null;
let pendingFocusRestoreFrame = null;
let isRestoringEditorFocus = false;

function clone(value) {
  return structuredClone(value);
}

function isLiveMode() {
  return isSupabaseConfigured();
}

function isPasswordGateEnabled() {
  return Boolean(APP_CONFIG.sitePassword);
}

function getCompanyOptions() {
  if (!state.companies.length) {
    return [{ id: PREVIEW_COMPANY.id, companyName: PREVIEW_COMPANY.companyName }];
  }

  return state.companies.map((company) => ({
    id: company.id,
    companyName: company.companyName
  }));
}

function getPreferredCompanyId() {
  if (state.preferredCompanyId && state.companies.some((company) => company.id === state.preferredCompanyId)) {
    return state.preferredCompanyId;
  }

  return state.companies[0]?.id || PREVIEW_COMPANY.id;
}

function getEditorCompany(editor = state.editor) {
  if (!editor) {
    return PREVIEW_COMPANY;
  }

  return state.companies.find((company) => company.id === editor.companyId) || PREVIEW_COMPANY;
}

function findEditorBlock(blockId, editor = state.editor) {
  if (!editor) {
    return null;
  }

  return editor.design.blocks.find((block) => block.id === blockId) || null;
}

function getModalCompany() {
  if (state.modal.open) {
    return state.modal.draft || createCompany();
  }

  return state.companies.find((company) => company.id === state.modal.companyId) || createCompany();
}

function getFilteredCompanies() {
  const searchQuery = state.filters.search.trim().toLowerCase();

  return state.companies.filter((company) => {
    const matchesStatus =
      state.filters.status === "all" || company.status === state.filters.status;
    const matchesSearch =
      !searchQuery ||
      company.companyName.toLowerCase().includes(searchQuery) ||
      company.contactName.toLowerCase().includes(searchQuery);

    return matchesStatus && matchesSearch;
  });
}

function getCalendarEvents() {
  return buildCalendarEvents(state.companies);
}

function getCalendarEventById(eventId) {
  return getCalendarEvents().find((event) => event.id === eventId) || null;
}

function shiftCalendarReference(monthDelta) {
  const nextDate = new Date(state.calendar.referenceDate || new Date().toISOString());
  nextDate.setDate(1);
  nextDate.setMonth(nextDate.getMonth() + monthDelta);
  state.calendar.referenceDate = nextDate.toISOString().slice(0, 10);
}

function getFollowUpWorkflowContext() {
  const workflow = state.calendar.workflow;
  if (!workflow.open) {
    return null;
  }

  const event = getCalendarEventById(workflow.eventId);
  if (!event) {
    return null;
  }

  const company = state.companies.find((item) => item.id === event.companyId) || PREVIEW_COMPANY;
  const selectedTemplate =
    state.templates.find((template) => template.id === workflow.selectedTemplateId) || null;
  const preview = selectedTemplate
    ? templateService.previewTemplate(
        {
          subject: selectedTemplate.subject,
          design: selectedTemplate.design
        },
        company
      )
    : null;

  return {
    workflow: {
      ...workflow,
      event
    },
    company,
    preview
  };
}

function upsertCompanyInState(company) {
  const exists = state.companies.some((item) => item.id === company.id);
  const nextCompanies = exists
    ? state.companies.map((item) => (item.id === company.id ? company : item))
    : [...state.companies, company];

  state.companies = [...nextCompanies].sort((left, right) => {
    if (right.contributionValue !== left.contributionValue) {
      return right.contributionValue - left.contributionValue;
    }

    return left.companyName.localeCompare(right.companyName);
  });
}

function resetModalResearchState() {
  state.modal.researchLoading = false;
  state.modal.researchError = "";
  state.modal.researchResult = null;
  state.modal.researchMode = "website";
  state.modal.completedResearchEntries = [];
}

function applyResearchSuggestionsToDraft(result) {
  if (!result) {
    return;
  }

  const topContact = result.contacts?.[0] || null;
  const topEmail = result.emails?.[0] || null;
  const nextNotes = [state.modal.draft.notes || ""];

  if (result.signals?.length) {
    nextNotes.push(`Research signals: ${result.signals.join(" | ")}`);
  }

  if (result.pages?.length) {
    nextNotes.push(`Sources scanned: ${result.pages.map((page) => page.label || page.url).join(" | ")}`);
  }

  state.modal.draft = createCompany({
    ...state.modal.draft,
    companyName: state.modal.draft.companyName || result.companyName || "",
    website: state.modal.draft.website || result.website || "",
    contactName: state.modal.draft.contactName || topContact?.name || "",
    contactRole: state.modal.draft.contactRole || topContact?.role || "",
    contactEmail: state.modal.draft.contactEmail || topEmail?.email || "",
    sector: state.modal.draft.sector || result.sector || "",
    askType: result.recommendedAskType || state.modal.draft.askType,
    researchSummary: result.summary || state.modal.draft.researchSummary || "",
    personalizationNotes: result.personalization || state.modal.draft.personalizationNotes || "",
    notes: nextNotes.filter(Boolean).join("\n\n")
  });
}

function buildResearchResultViewModel(result) {
  if (!result) {
    return null;
  }

  return {
    ...result,
    recommendedAskTypeLabel: result.recommendedAskType
      ? getOptionLabel(askTypeOptions, result.recommendedAskType)
      : "",
    pagesScanned: result.pages?.length || 0,
    candidates: buildResearchCandidates(result)
  };
}

function getResearchSourceLabel(result, sourceUrl = "") {
  if (!sourceUrl || !result?.pages?.length) {
    return "Public page";
  }

  const page = result.pages.find((entry) => entry.url === sourceUrl);
  if (page?.label) {
    return page.label;
  }

  try {
    const url = new URL(sourceUrl);
    return url.pathname && url.pathname !== "/" ? url.pathname.replace(/\//g, " ").trim() : url.hostname;
  } catch {
    return "Public page";
  }
}

function buildResearchCandidates(result) {
  if (!result) {
    return [];
  }

  return (result.emails || []).map((entry, index) => {
    const matchingContact =
      (result.contacts || []).find((contact) => contact.source === entry.source) || null;
    return {
      id: `${entry.email || "email"}-${index}`,
      email: entry.email || "",
      source: entry.source || "",
      areaLabel: getResearchSourceLabel(result, entry.source),
      contactName: matchingContact?.name || "",
      contactRole: matchingContact?.role || ""
    };
  });
}

function applyResearchCandidate(candidate) {
  if (!candidate) {
    return;
  }

  state.modal.draft = createCompany({
    ...state.modal.draft,
    contactName: candidate.contactName || state.modal.draft.contactName,
    contactRole: candidate.contactRole || state.modal.draft.contactRole,
    contactEmail: candidate.email || state.modal.draft.contactEmail,
    website: state.modal.draft.website || state.modal.researchResult?.website || "",
    companyName: state.modal.draft.companyName || state.modal.researchResult?.companyName || "",
    sector: state.modal.draft.sector || state.modal.researchResult?.sector || "",
    askType: state.modal.researchResult?.recommendedAskType || state.modal.draft.askType,
    researchSummary: state.modal.researchResult?.summary || state.modal.draft.researchSummary || "",
    personalizationNotes:
      state.modal.researchResult?.personalization || state.modal.draft.personalizationNotes || ""
  });

  const nextCompleted = [
    candidate,
    ...state.modal.completedResearchEntries.filter((entry) => entry.id !== candidate.id)
  ];
  state.modal.completedResearchEntries = nextCompleted;
}

function showToast(message) {
  state.toast = message;
  renderApp();

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = "";
    renderApp();
  }, 2800);
}

function consumeOauthFeedback() {
  const url = new URL(window.location.href);
  const gmailState = url.searchParams.get("gmail");
  const gmailError = url.searchParams.get("gmail_error");

  if (!gmailState && !gmailError) {
    return;
  }

  if (gmailState === "connected") {
    showToast("Gmail connected.");
  }

  if (gmailError) {
    state.mailbox.error = gmailError;
    showToast(gmailError);
  }

  url.searchParams.delete("gmail");
  url.searchParams.delete("gmail_error");
  window.history.replaceState({}, "", url.toString());
}

function createEditorState({
  mode,
  id,
  templateId = "",
  nameInput = "",
  subjectInput = "",
  design,
  companyId = "",
  sidebarTab = "layers",
  selectedBlockId = "body",
  device = "desktop",
  createdAt = "",
  lastFocusedTarget = null
}) {
  const companyOptions = getCompanyOptions();
  const resolvedCompanyId =
    companyOptions.find((option) => option.id === companyId)?.id || companyOptions[0]?.id || "";

  return {
    open: true,
    mode,
    sourceId: id || crypto.randomUUID(),
    templateId,
    nameInput,
    subjectInput,
    design: templateService.normalizeTemplateDesign(design),
    selectedBlockId,
    sidebarTab,
    device,
    companyId: resolvedCompanyId,
    companyOptions,
    createdAt,
    lastFocusedTarget
  };
}

function syncEditorCompanyOptions() {
  if (!state.editor) {
    return;
  }

  state.editor.companyOptions = getCompanyOptions();

  if (!state.editor.companyOptions.some((option) => option.id === state.editor.companyId)) {
    state.editor.companyId = state.editor.companyOptions[0]?.id || "";
  }
}

function buildEditorPreview(editor = state.editor) {
  if (!editor) {
    return {
      subject: "",
      html: "",
      tokens: {},
      writing: analyzeEmailWriting()
    };
  }

  const preview = templateService.previewTemplate(
    {
      subject: editor.subjectInput,
      design: editor.design
    },
    getEditorCompany(editor)
  );

  return {
    ...preview,
    writing: analyzeEmailWriting({
      subject: preview.subject,
      design: editor.design,
      tokens: preview.tokens
    })
  };
}

function buildTemplateNameFromFilename(filename = "") {
  const baseName = String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!baseName) {
    return "Imported Template";
  }

  return baseName.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clearActiveDropZone() {
  if (activeDropZone) {
    activeDropZone.classList.remove("is-active");
  }

  activeDropZone = null;
}

function setActiveDropZone(dropZone) {
  if (activeDropZone === dropZone) {
    return;
  }

  clearActiveDropZone();

  if (dropZone) {
    dropZone.classList.add("is-active");
    activeDropZone = dropZone;
  }
}

function resetEditorDragState() {
  currentEditorDrag = null;
  clearActiveDropZone();
  document.body.classList.remove("is-editor-dragging");
}

function getBlockSpacingSnapshot(styles = {}) {
  return {
    paddingLeft: Number(styles.paddingLeft ?? styles.paddingX ?? 0),
    paddingRight: Number(styles.paddingRight ?? styles.paddingX ?? 0),
    paddingTop: Number(styles.paddingTop ?? 0),
    paddingBottom: Number(styles.paddingBottom ?? 0)
  };
}

function startLayoutDrag(blockId, event) {
  const block = findEditorBlock(blockId);
  if (!block) {
    return;
  }

  state.editor.selectedBlockId = blockId;
  currentLayoutDrag = {
    blockId,
    startX: event.clientX,
    startY: event.clientY,
    initial: getBlockSpacingSnapshot(block.styles)
  };
  document.body.classList.add("is-positioning-block");
  renderApp();
}

function updateLayoutDrag(event) {
  if (!currentLayoutDrag || !state.editor) {
    return;
  }

  const block = findEditorBlock(currentLayoutDrag.blockId);
  if (!block) {
    return;
  }

  const deltaX = event.clientX - currentLayoutDrag.startX;
  const deltaY = event.clientY - currentLayoutDrag.startY;
  const nextLeft = Math.max(0, Math.round(currentLayoutDrag.initial.paddingLeft + deltaX));
  const nextRight = Math.max(0, Math.round(currentLayoutDrag.initial.paddingRight - deltaX));
  const nextTop = Math.max(0, Math.round(currentLayoutDrag.initial.paddingTop + deltaY));
  const nextBottom = Math.max(0, Math.round(currentLayoutDrag.initial.paddingBottom - deltaY));

  block.styles.paddingLeft = nextLeft;
  block.styles.paddingRight = nextRight;
  block.styles.paddingTop = nextTop;
  block.styles.paddingBottom = nextBottom;
  delete block.styles.paddingX;
  renderApp();
}

function endLayoutDrag() {
  if (!currentLayoutDrag) {
    return;
  }

  currentLayoutDrag = null;
  document.body.classList.remove("is-positioning-block");
}

function buildFocusSnapshot(target, base = {}) {
  const snapshot = { ...base };

  if (typeof target.selectionStart === "number" && typeof target.selectionEnd === "number") {
    snapshot.selectionStart = target.selectionStart;
    snapshot.selectionEnd = target.selectionEnd;
  }

  if (typeof target.selectionDirection === "string") {
    snapshot.selectionDirection = target.selectionDirection;
  }

  if (typeof target.scrollTop === "number") {
    snapshot.scrollTop = target.scrollTop;
  }

  if (typeof target.scrollLeft === "number") {
    snapshot.scrollLeft = target.scrollLeft;
  }

  return snapshot;
}

function getEditorFocusSelector(target = state.editor?.lastFocusedTarget) {
  if (!target) {
    return "";
  }

  if (target.kind === "subject") {
    return "#editor-subject";
  }

  if (target.kind === "name") {
    return "#editor-name";
  }

  if (target.kind === "company") {
    return "#editor-company";
  }

  if (target.kind === "block-content") {
    return `[data-editor-scope="block-content"][data-editor-field="${target.field}"]`;
  }

  if (target.kind === "block-style") {
    return `[data-editor-scope="block-style"][data-editor-field="${target.field}"]`;
  }

  if (target.kind === "canvas") {
    return `[data-editor-scope="canvas"][data-editor-field="${target.field}"]`;
  }

  return "";
}

function restoreEditorFocus() {
  if (!state.editor?.lastFocusedTarget) {
    return;
  }

  const focusTarget = { ...state.editor.lastFocusedTarget };
  const selector = getEditorFocusSelector(focusTarget);
  if (!selector) {
    return;
  }

  const input = root.querySelector(selector);
  if (!input) {
    return;
  }

  isRestoringEditorFocus = true;

  try {
    input.focus({ preventScroll: true });

    if (
      typeof focusTarget.selectionStart === "number" &&
      typeof focusTarget.selectionEnd === "number" &&
      typeof input.setSelectionRange === "function"
    ) {
      input.setSelectionRange(
        focusTarget.selectionStart,
        focusTarget.selectionEnd,
        focusTarget.selectionDirection || "none"
      );
    }

    if (typeof focusTarget.scrollTop === "number") {
      input.scrollTop = focusTarget.scrollTop;
    }

    if (typeof focusTarget.scrollLeft === "number") {
      input.scrollLeft = focusTarget.scrollLeft;
    }
  } finally {
    isRestoringEditorFocus = false;
  }
}

function scheduleEditorFocusRestore() {
  if (pendingFocusRestoreFrame) {
    window.cancelAnimationFrame(pendingFocusRestoreFrame);
  }

  pendingFocusRestoreFrame = window.requestAnimationFrame(() => {
    restoreEditorFocus();
    shouldRestoreEditorFocus = false;
    pendingFocusRestoreFrame = null;
  });
}

function renderShell() {
  const filteredCompanies = getFilteredCompanies();
  const snapshot = buildDashboardSnapshot(state.companies, APP_CONFIG.fundraisingTarget);
  const events = getCalendarEvents();
  const summary = buildCalendarSummary(events);
  const calendarMonth = buildCalendarMonthView(events, state.calendar.referenceDate);
  const modeLabel = isLiveMode() ? "Live Supabase mode" : "Demo mode";
  const workflowContext = getFollowUpWorkflowContext();

  return `
    <div class="site-layout">
      <aside class="sidebar">
        <div class="sidebar-panel brand-panel">
          <div class="brand-logo-wrap">
            <img src="${escapeHtml(APP_CONFIG.logoPath)}" alt="${escapeHtml(
    APP_CONFIG.teamName
  )} logo" class="brand-logo" />
          </div>
          <span class="eyebrow">Pit Wall Ops</span>
          <h1>${escapeHtml(APP_CONFIG.teamName)}</h1>
          <p>${escapeHtml(APP_CONFIG.seasonLabel)}</p>
        </div>
        <nav class="sidebar-panel nav-panel">
          <a href="#overview">Overview</a>
          <a href="#companies">Companies</a>
          <a href="#calendar">Calendar</a>
          <a href="#mailbox">Mailbox</a>
          <a href="#emails">Email Studio</a>
        </nav>
        <div class="sidebar-panel status-panel">
          <span class="metric-label">Workspace Mode</span>
          <strong>${modeLabel}</strong>
          <p>
            ${
              isLiveMode()
                ? "Shared password gate enabled with Supabase data underneath."
                : "Running on local demo data until Supabase keys are configured."
            }
          </p>
          ${
            isPasswordGateEnabled()
              ? `<button type="button" class="ghost-button" data-action="sign-out">Sign Out</button>`
              : ""
          }
        </div>
      </aside>
      <main class="workspace">
        ${renderDashboardView({ config: APP_CONFIG, snapshot })}
        ${renderCompaniesView({
          filters: state.filters,
          companies: filteredCompanies,
          totalCompanies: state.companies.length
        })}
        ${renderCalendarView({ events, summary, calendarMonth })}
        ${renderMailboxView({
          mailbox: state.mailbox
        })}
        ${renderEmailStudioView({
          templates: state.templates,
          drafts: state.drafts
        })}
      </main>
      ${renderCompanyModal(state.modal, getModalCompany())}
      ${
        workflowContext
          ? renderFollowUpWorkflowModal({
              workflow: workflowContext.workflow,
              templates: state.templates,
              company: workflowContext.company,
              preview: workflowContext.preview,
              gmailConnected: state.mailbox.connected
            })
          : ""
      }
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderLoadingScreen() {
  return `
    <main class="auth-page">
      <section class="auth-panel auth-panel--loading">
        <span class="eyebrow">Loading</span>
        <h1>Building your sponsor workspace...</h1>
      </section>
    </main>
  `;
}

function renderApp() {
  if (!state.editor?.open && pendingFocusRestoreFrame) {
    window.cancelAnimationFrame(pendingFocusRestoreFrame);
    pendingFocusRestoreFrame = null;
  }

  if (state.loading) {
    root.innerHTML = renderLoadingScreen();
    return;
  }

  if (isPasswordGateEnabled() && !authService.isSignedIn()) {
    root.innerHTML = renderAuthView({
      config: APP_CONFIG,
      loginError: state.loginError
    });
    return;
  }

  if (state.editor?.open) {
    const preview = buildEditorPreview(state.editor);
    root.innerHTML = renderTemplateEditorView({
      editor: state.editor,
      company: getEditorCompany(state.editor),
      preview
    });
    if (shouldRestoreEditorFocus) {
      scheduleEditorFocusRestore();
    }
    return;
  }

  root.innerHTML = renderShell();
}

async function loadAppData() {
  state.loading = true;
  renderApp();

  try {
    const [companies, templates] = await Promise.all([
      companyService.loadCompanies(),
      templateService.loadTemplates()
    ]);

    state.companies = companies;
    state.templates = templates;
    state.drafts = draftService.loadDrafts();

    if (!state.companies.some((company) => company.id === state.preferredCompanyId)) {
      state.preferredCompanyId = state.companies[0]?.id || "";
    }

    syncEditorCompanyOptions();
    consumeOauthFeedback();
    await loadMailboxStatus();
    state.loading = false;
    state.loginError = "";
    renderApp();
  } catch (error) {
    console.error(error);
    state.loading = false;

    if (isLiveMode()) {
      await authService.signOut();
      state.loginError = error.message || "Could not load your Supabase workspace.";
    } else {
      showToast("Could not load demo data.");
    }

    renderApp();
  }
}

async function init() {
  if (isPasswordGateEnabled()) {
    state.loading = false;
      renderApp();

      if (authService.isSignedIn()) {
        await loadAppData();
      }

    return;
  }

  await loadAppData();
}

async function loadMailboxStatus() {
  try {
    const status = await gmailService.loadStatus();
    state.mailbox.connected = Boolean(status.connected);
    state.mailbox.connectUrl = gmailService.getConnectUrl();
    state.mailbox.emailAddress = status.emailAddress || "";
    state.mailbox.error = status.error || "";

    if (!status.connected) {
      state.mailbox.messages = [];
      state.mailbox.selectedMessageId = "";
      state.mailbox.selectedMessage = null;
      return;
    }

    await loadMailboxMessages(false);
  } catch (error) {
    state.mailbox.connected = false;
    state.mailbox.error = error.message || "Could not load mailbox status.";
  }
}

async function loadMailboxMessages(showSpinner = true) {
  if (showSpinner) {
    state.mailbox.loading = true;
    renderApp();
  }

  try {
    const messages = await gmailService.loadMessages(state.mailbox.query);
    state.mailbox.messages = messages;

    const nextSelectedId =
      messages.find((message) => message.id === state.mailbox.selectedMessageId)?.id ||
      messages[0]?.id ||
      "";
    state.mailbox.selectedMessageId = nextSelectedId;
    state.mailbox.selectedMessage = null;

    if (nextSelectedId) {
      await openMailboxMessage(nextSelectedId, false);
    }
  } catch (error) {
    state.mailbox.error = error.message || "Could not load inbox messages.";
  } finally {
    state.mailbox.loading = false;
    renderApp();
  }
}

async function openMailboxMessage(messageId, rerender = true) {
  try {
    state.mailbox.selectedMessageId = messageId;
    const message = await gmailService.loadMessage(messageId);
    state.mailbox.selectedMessage = message;
    state.mailbox.error = "";
  } catch (error) {
    state.mailbox.error = error.message || "Could not open message.";
  }

  if (rerender) {
    renderApp();
  }
}

function closeModal() {
  state.modal.open = false;
  state.modal.companyId = "";
  state.modal.draft = createCompany();
  state.modal.saving = false;
  state.modal.error = "";
  resetModalResearchState();
  renderApp();
}

function openCompanyModal(companyId = "") {
  const existingCompany = companyId
    ? state.companies.find((company) => company.id === companyId) || createCompany()
    : {
        ...createCompany(),
        id: ""
      };

  state.modal.open = true;
  state.modal.companyId = companyId;
  state.modal.draft = {
    ...clone(existingCompany),
    hasProposalDate: Boolean(existingCompany.proposalDate),
    hasInterviewDate: Boolean(existingCompany.interviewDate)
  };
  state.modal.saving = false;
  state.modal.error = "";
  resetModalResearchState();
  state.modal.researchMode = existingCompany.website ? "website" : "company";
  renderApp();
}

function closeEditor() {
  endLayoutDrag();
  state.editor = null;
  renderApp();
}

function focusEmailStudioForCompany(companyId) {
  state.preferredCompanyId = companyId;
  renderApp();
  document.querySelector("#emails")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Draft mode will now default to that company.");
}

function openFollowUpWorkflow(eventId) {
  const event = getCalendarEventById(eventId);
  if (!event) {
    showToast("That follow-up could not be found.");
    return;
  }

  state.calendar.workflow = {
    open: true,
    eventId,
    selectedTemplateId: state.templates[0]?.id || "",
    sending: false,
    error: ""
  };
  renderApp();
}

function closeFollowUpWorkflow() {
  state.calendar.workflow = {
    open: false,
    eventId: "",
    selectedTemplateId: "",
    sending: false,
    error: ""
  };
  renderApp();
}

function openFollowUpDraftEditor() {
  const context = getFollowUpWorkflowContext();
  if (!context?.workflow?.selectedTemplateId) {
    showToast("Choose a template first.");
    return;
  }

  closeFollowUpWorkflow();
  state.preferredCompanyId = context.company.id;
  openDraftEditorFromTemplate(context.workflow.selectedTemplateId);
}

async function sendFollowUpEmail() {
  const context = getFollowUpWorkflowContext();
  if (!context) {
    return;
  }

  if (!context.workflow.selectedTemplateId) {
    state.calendar.workflow.error = "Choose a template before sending.";
    renderApp();
    return;
  }

  if (!context.company.contactEmail) {
    state.calendar.workflow.error = "This company does not have a contact email saved yet.";
    renderApp();
    return;
  }

  if (!state.mailbox.connected) {
    state.calendar.workflow.error = "Connect Gmail in the Mailbox section before sending from here.";
    renderApp();
    return;
  }

  state.calendar.workflow.sending = true;
  state.calendar.workflow.error = "";
  renderApp();

  try {
    await gmailService.sendMessage({
      to: context.company.contactEmail,
      subject: context.preview.subject,
      htmlBody: context.preview.html
    });
    await loadMailboxMessages(false);
    closeFollowUpWorkflow();
    showToast(`Email sent to ${context.company.companyName}.`);
  } catch (error) {
    state.calendar.workflow.sending = false;
    state.calendar.workflow.error = error.message || "Could not send this follow-up email.";
    renderApp();
  }
}

function openTemplateEditor(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) {
    showToast("That template could not be found.");
    return;
  }

  state.editor = createEditorState({
    mode: "template",
    id: template.id,
    templateId: template.id,
    nameInput: template.name,
    subjectInput: template.subject,
    design: template.design
  });
  renderApp();
}

function openDraftEditorFromTemplate(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) {
    showToast("That template could not be found.");
    return;
  }

  const company = state.companies.find((item) => item.id === getPreferredCompanyId()) || PREVIEW_COMPANY;
  const companyName = company.companyName || "Draft";

  state.editor = createEditorState({
    mode: "draft",
    id: crypto.randomUUID(),
    templateId: template.id,
    nameInput: `${template.name} - ${companyName}`,
    subjectInput: template.subject,
    design: clone(template.design),
    companyId: company.id
  });
  renderApp();
}

function openSavedDraft(draftId) {
  const draft = state.drafts.find((item) => item.id === draftId);
  if (!draft) {
    showToast("That saved draft could not be found.");
    return;
  }

  state.editor = createEditorState({
    mode: "draft",
    id: draft.id,
    templateId: draft.templateId,
    nameInput: draft.name,
    subjectInput: draft.subject,
    design: draft.design,
    companyId: draft.companyId || getPreferredCompanyId(),
    createdAt: draft.createdAt || "",
    selectedBlockId: draft.selectedBlockId || "body"
  });
  renderApp();
}

function createNewTemplate() {
  const starter = templateService.createStarterTemplate(state.templates.length + 1);

  state.editor = createEditorState({
    mode: "template",
    id: starter.id,
    templateId: starter.id,
    nameInput: starter.name,
    subjectInput: starter.subject,
    design: starter.design
  });
  renderApp();
}

function replaceEditorWithImportedHtml(html, suggestedName = "") {
  if (!state.editor) {
    return;
  }

  const imported = templateService.importTemplateHtml(html, {
    name: state.editor.nameInput.trim() || suggestedName || "Imported Template",
    subject: state.editor.subjectInput.trim() || "{{team_name}} update for {{company_name}}"
  });

  state.editor.design = imported.design;
  if (!state.editor.nameInput.trim()) {
    state.editor.nameInput = imported.name;
  }
  if (!state.editor.subjectInput.trim()) {
    state.editor.subjectInput = imported.subject;
  }
  state.editor.selectedBlockId = imported.design.blocks[0]?.id || "body";
  state.editor.sidebarTab = "layers";
  renderApp();
  showToast("Imported HTML converted into editable Atomic blocks.");
}

function openImportedTemplateEditor(html, suggestedName = "") {
  const importedTemplate = templateService.createImportedTemplate({
    name: suggestedName || "Imported Template",
    html
  });

  state.editor = createEditorState({
    mode: "template",
    id: importedTemplate.id,
    templateId: importedTemplate.id,
    nameInput: importedTemplate.name,
    subjectInput: importedTemplate.subject,
    design: importedTemplate.design,
    selectedBlockId: importedTemplate.design.blocks[0]?.id || "body"
  });
  renderApp();
  showToast(`${importedTemplate.name} imported and ready to edit.`);
}

async function importHtmlFile(file, target = "new-template") {
  if (!file) {
    return;
  }

  const html = await file.text();
  if (!String(html || "").trim()) {
    showToast("That file was empty.");
    return;
  }

  const templateName = buildTemplateNameFromFilename(file.name);

  if (target === "replace-editor") {
    replaceEditorWithImportedHtml(html, templateName);
    return;
  }

  openImportedTemplateEditor(html, templateName);
}

function findSelectedBlock() {
  if (!state.editor || state.editor.selectedBlockId === "body") {
    return null;
  }

  return findEditorBlock(state.editor.selectedBlockId);
}

function updateSelectedBlock(mutator) {
  const block = findSelectedBlock();
  if (!block) {
    return;
  }

  mutator(block);
}

function coerceEditorValue(rawValue, inputType) {
  if (inputType === "number") {
    return Number(rawValue || 0);
  }

  return rawValue;
}

function rememberEditorFocus(target) {
  if (!state.editor) {
    return;
  }

  if (target.id === "editor-subject") {
    state.editor.lastFocusedTarget = buildFocusSnapshot(target, {
      kind: "subject"
    });
    return;
  }

  if (target.id === "editor-name") {
    state.editor.lastFocusedTarget = buildFocusSnapshot(target, {
      kind: "name"
    });
    return;
  }

  if (target.id === "editor-company") {
    state.editor.lastFocusedTarget = {
      kind: "company"
    };
    return;
  }

  if (target.dataset.editorScope === "block-content") {
    state.editor.lastFocusedTarget = buildFocusSnapshot(target, {
      kind: "block-content",
      blockId: state.editor.selectedBlockId,
      field: target.dataset.editorField
    });
    return;
  }

  if (target.dataset.editorScope === "block-style") {
    state.editor.lastFocusedTarget = buildFocusSnapshot(target, {
      kind: "block-style",
      blockId: state.editor.selectedBlockId,
      field: target.dataset.editorField
    });
    return;
  }

  if (target.dataset.editorScope === "canvas") {
    state.editor.lastFocusedTarget = buildFocusSnapshot(target, {
      kind: "canvas",
      field: target.dataset.editorField
    });
  }
}

function insertTokenIntoEditor(token) {
  if (!state.editor) {
    return;
  }

  const target = state.editor.lastFocusedTarget;

  if (target?.kind === "subject") {
    state.editor.subjectInput = `${state.editor.subjectInput}${token}`;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (target?.kind === "name") {
    state.editor.nameInput = `${state.editor.nameInput}${token}`;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (target?.kind === "block-content") {
    const block = state.editor.design.blocks.find((item) => item.id === target.blockId);
    if (block) {
      const currentValue = String(block.content?.[target.field] || "");
      block.content[target.field] = `${currentValue}${token}`;
      shouldRestoreEditorFocus = true;
      renderApp();
      return;
    }
  }

  const selectedBlock = findSelectedBlock();
  if (selectedBlock && (selectedBlock.type === "heading" || selectedBlock.type === "paragraph")) {
    selectedBlock.content.text = `${selectedBlock.content.text || ""}${token}`;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (selectedBlock && selectedBlock.type === "button") {
    selectedBlock.content.label = `${selectedBlock.content.label || ""}${token}`;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  state.editor.subjectInput = `${state.editor.subjectInput}${token}`;
  shouldRestoreEditorFocus = true;
  renderApp();
}

function addBlockToEditor(type) {
  if (!state.editor) {
    return;
  }

  const nextBlock = templateService.createBlock(type);
  const blocks = state.editor.design.blocks;
  const selectedIndex = blocks.findIndex((block) => block.id === state.editor.selectedBlockId);
  const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : blocks.length;

  blocks.splice(insertIndex, 0, nextBlock);
  state.editor.selectedBlockId = nextBlock.id;
  state.editor.sidebarTab = "layers";
  renderApp();
}

function insertBlockAtIndex(type, targetIndex) {
  if (!state.editor) {
    return;
  }

  const block = templateService.createBlock(type);
  const blocks = state.editor.design.blocks;
  const safeIndex = Math.max(0, Math.min(targetIndex, blocks.length));
  blocks.splice(safeIndex, 0, block);
  state.editor.selectedBlockId = block.id;
  state.editor.sidebarTab = "layers";
}

function duplicateSelectedBlock() {
  if (!state.editor || state.editor.selectedBlockId === "body") {
    return;
  }

  const blocks = state.editor.design.blocks;
  const currentIndex = blocks.findIndex((block) => block.id === state.editor.selectedBlockId);
  if (currentIndex < 0) {
    return;
  }

  const duplicate = templateService.duplicateBlock(blocks[currentIndex]);
  blocks.splice(currentIndex + 1, 0, duplicate);
  state.editor.selectedBlockId = duplicate.id;
  renderApp();
}

function moveBlockToIndex(blockId, targetIndex) {
  if (!state.editor) {
    return;
  }

  const blocks = state.editor.design.blocks;
  const currentIndex = blocks.findIndex((block) => block.id === blockId);
  if (currentIndex < 0) {
    return;
  }

  const boundedTarget = Math.max(0, Math.min(targetIndex, blocks.length));
  if (boundedTarget === currentIndex || boundedTarget === currentIndex + 1) {
    state.editor.selectedBlockId = blockId;
    return;
  }

  const [block] = blocks.splice(currentIndex, 1);
  const adjustedTarget = currentIndex < boundedTarget ? boundedTarget - 1 : boundedTarget;
  blocks.splice(adjustedTarget, 0, block);
  state.editor.selectedBlockId = block.id;
}

function handleEditorDrop(targetIndex) {
  if (!state.editor || !currentEditorDrag) {
    return;
  }

  if (currentEditorDrag.kind === "new-block") {
    insertBlockAtIndex(currentEditorDrag.blockType, targetIndex);
    renderApp();
    return;
  }

  if (currentEditorDrag.kind === "existing-block") {
    moveBlockToIndex(currentEditorDrag.blockId, targetIndex);
    renderApp();
  }
}

function moveSelectedBlock(direction) {
  if (!state.editor || state.editor.selectedBlockId === "body") {
    return;
  }

  const blocks = state.editor.design.blocks;
  const currentIndex = blocks.findIndex((block) => block.id === state.editor.selectedBlockId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= blocks.length) {
    return;
  }

  const [block] = blocks.splice(currentIndex, 1);
  blocks.splice(nextIndex, 0, block);
  renderApp();
}

function deleteSelectedBlock() {
  if (!state.editor || state.editor.selectedBlockId === "body") {
    return;
  }

  state.editor.design.blocks = state.editor.design.blocks.filter(
    (block) => block.id !== state.editor.selectedBlockId
  );
  state.editor.selectedBlockId = "body";
  renderApp();
}

async function handleLoginSubmit(form) {
  const formData = new FormData(form);
  const password = String(formData.get("password") || "");

  state.loading = true;
  state.loginError = "";
  renderApp();

  try {
    await authService.signIn(password, APP_CONFIG.sitePassword);
    await loadAppData();
  } catch (error) {
    state.loading = false;
    state.loginError = error.message || "Sign in failed.";
    renderApp();
  }
}

async function handleCompanySubmit(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const hasProposalDate = formData.has("hasProposalDate");
  const hasInterviewDate = formData.has("hasInterviewDate");
  delete payload.hasProposalDate;
  delete payload.hasInterviewDate;

  if (!hasProposalDate) {
    payload.proposalDate = "";
  }

  if (!hasInterviewDate) {
    payload.interviewDate = "";
  }

  payload.askValue = Number(payload.askValue || 0);
  payload.contributionValue = Number(payload.contributionValue || 0);
  payload.lastUpdated = new Date().toISOString();
  state.modal.draft = {
    ...state.modal.draft,
    ...payload
  };
  state.modal.saving = true;
  state.modal.error = "";
  renderApp();

  try {
    const savedCompany = await companyService.saveCompany(payload);
    upsertCompanyInState(savedCompany);
    state.preferredCompanyId = savedCompany.id;
    syncEditorCompanyOptions();
    closeModal();
    showToast(`${savedCompany.companyName} saved.`);

    try {
      state.companies = await companyService.loadCompanies();
      syncEditorCompanyOptions();
      renderApp();
    } catch (refreshError) {
      console.warn("Company saved but live refresh failed.", refreshError);
    }
  } catch (error) {
    console.error(error);
    state.modal.saving = false;
    state.modal.error = error.message || "Could not save company.";
    renderApp();
    showToast(error.message || "Could not save company.");
  }
}

async function runCompanyResearch(form) {
  const formData = new FormData(form);
  const companyName = String(formData.get("companyName") || state.modal.draft.companyName || "").trim();
  const website = String(formData.get("website") || state.modal.draft.website || "").trim();

  if (state.modal.researchMode === "website" && !website) {
    showToast("Add the company website first.");
    return;
  }

  if (state.modal.researchMode === "company" && !companyName) {
    showToast("Add the company name first.");
    return;
  }

  state.modal.draft = {
    ...state.modal.draft,
    companyName,
    website
  };
  state.modal.researchLoading = true;
  state.modal.researchError = "";
  renderApp();

  try {
    const result = await companyResearchService.researchCompany({
      companyName,
      website,
      searchMode: state.modal.researchMode
    });
    state.modal.researchLoading = false;
    state.modal.researchResult = buildResearchResultViewModel(result);
    if (!state.modal.draft.website && state.modal.researchResult?.website) {
      state.modal.draft = createCompany({
        ...state.modal.draft,
        website: state.modal.researchResult.website
      });
    }
    renderApp();
    showToast("Website research complete.");
  } catch (error) {
    console.error(error);
    state.modal.researchLoading = false;
    state.modal.researchError = error.message || "Could not research that website.";
    renderApp();
    showToast(error.message || "Could not research that website.");
  }
}

async function saveTemplateFromEditor() {
  if (!state.editor || state.editor.mode !== "template") {
    return;
  }

  const existingTemplate = state.templates.find((template) => template.id === state.editor.sourceId);
  const templateName =
    state.editor.nameInput.trim() || existingTemplate?.name || `Atomic Template ${state.templates.length + 1}`;

  try {
    const savedTemplate = await templateService.saveTemplate({
      id: state.editor.sourceId,
      name: templateName,
      category: existingTemplate?.category || "Custom",
      subject: state.editor.subjectInput.trim() || "{{team_name}} update for {{company_name}}",
      design: state.editor.design
    });

    state.templates = await templateService.loadTemplates();
    state.editor.sourceId = savedTemplate.id;
    state.editor.templateId = savedTemplate.id;
    state.editor.nameInput = savedTemplate.name;
    state.editor.subjectInput = savedTemplate.subject;
    state.editor.design = templateService.normalizeTemplateDesign(savedTemplate.design);
    renderApp();
    showToast(`${savedTemplate.name} saved as a master template.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save template.");
  }
}

function buildDraftPayload() {
  const company = getEditorCompany(state.editor);
  const existingDraft = state.drafts.find((draft) => draft.id === state.editor.sourceId);
  const template = state.templates.find((item) => item.id === state.editor.templateId);

  return {
    id: state.editor.sourceId,
    templateId: state.editor.templateId || template?.id || "",
    name:
      state.editor.nameInput.trim() ||
      `${template?.name || "Email Draft"} - ${company.companyName || "Draft"}`,
    subject: state.editor.subjectInput.trim() || template?.subject || "",
    design: clone(state.editor.design),
    companyId: company.id === PREVIEW_COMPANY.id ? "" : company.id,
    companyName: company.companyName || "",
    selectedBlockId: state.editor.selectedBlockId,
    createdAt: existingDraft?.createdAt || state.editor.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function saveDraftFromEditor() {
  if (!state.editor || state.editor.mode !== "draft") {
    return;
  }

  try {
    const savedDraft = draftService.saveDraft(buildDraftPayload());
    state.drafts = draftService.loadDrafts();
    state.editor.sourceId = savedDraft.id;
    state.editor.createdAt = savedDraft.createdAt;
    state.editor.nameInput = savedDraft.name;
    renderApp();
    showToast(`${savedDraft.name} saved as a one-off draft.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save draft.");
  }
}

async function copyTextToClipboard(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    console.error(error);
    showToast("Clipboard access failed.");
  }
}

root.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, id } = actionTarget.dataset;

  switch (action) {
    case "open-add-company":
      openCompanyModal();
      return;
    case "calendar-month-prev":
      shiftCalendarReference(-1);
      renderApp();
      return;
    case "calendar-month-today":
      state.calendar.referenceDate = new Date().toISOString().slice(0, 10);
      renderApp();
      return;
    case "calendar-month-next":
      shiftCalendarReference(1);
      renderApp();
      return;
    case "open-follow-up-workflow":
      openFollowUpWorkflow(id);
      return;
    case "close-follow-up-workflow":
      closeFollowUpWorkflow();
      return;
    case "open-follow-up-draft-editor":
      openFollowUpDraftEditor();
      return;
    case "send-follow-up-email":
      await sendFollowUpEmail();
      return;
    case "research-company": {
      const form = root.querySelector("#company-form");
      if (!form || state.modal.researchLoading) {
        return;
      }

      await runCompanyResearch(form);
      return;
    }
    case "set-research-mode":
      state.modal.researchMode = id === "company" ? "company" : "website";
      state.modal.researchError = "";
      renderApp();
      return;
    case "apply-research-suggestions":
      if (!state.modal.researchResult) {
        return;
      }

      applyResearchSuggestionsToDraft(state.modal.researchResult);
      renderApp();
      showToast("Research suggestions applied.");
      return;
    case "select-research-candidate": {
      const candidate = buildResearchCandidates(state.modal.researchResult).find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      applyResearchCandidate(candidate);
      renderApp();
      showToast("Research result applied.");
      return;
    }
    case "reopen-completed-research": {
      const candidate = state.modal.completedResearchEntries.find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      applyResearchCandidate(candidate);
      renderApp();
      showToast("Completed result reopened.");
      return;
    }
    case "apply-research-contact": {
      const contact = state.modal.researchResult?.contacts?.[Number(id)] || null;
      if (!contact) {
        return;
      }

      state.modal.draft = createCompany({
        ...state.modal.draft,
        contactName: contact.name || state.modal.draft.contactName,
        contactRole: contact.role || state.modal.draft.contactRole
      });
      renderApp();
      showToast("Contact details applied.");
      return;
    }
    case "apply-research-email": {
      const email = state.modal.researchResult?.emails?.[Number(id)] || null;
      if (!email) {
        return;
      }

      state.modal.draft = createCompany({
        ...state.modal.draft,
        contactEmail: email.email || state.modal.draft.contactEmail
      });
      renderApp();
      showToast("Email applied.");
      return;
    }
    case "save-company": {
      const form = root.querySelector("#company-form");
      if (!form || state.modal.saving) {
        return;
      }

      if (!form.reportValidity()) {
        showToast("Please fill in the required company fields.");
        return;
      }

      await handleCompanySubmit(form);
      return;
    }
    case "close-modal":
      closeModal();
      return;
    case "edit-company":
      openCompanyModal(id);
      return;
    case "delete-company":
      if (!window.confirm("Delete this company record?")) {
        return;
      }

      try {
        await companyService.deleteCompany(id);
        state.companies = await companyService.loadCompanies();
        const updatedDrafts = draftService.loadDrafts().map((draft) =>
          draft.companyId === id
            ? {
                ...draft,
                companyId: "",
                companyName: ""
              }
            : draft
        );
        updatedDrafts.forEach((draft) => {
          draftService.saveDraft(draft);
        });
        state.drafts = draftService.loadDrafts();

        if (state.preferredCompanyId === id) {
          state.preferredCompanyId = state.companies[0]?.id || "";
        }

        syncEditorCompanyOptions();
        renderApp();
        showToast("Company deleted.");
      } catch (error) {
        console.error(error);
        showToast(error.message || "Could not delete company.");
      }
      return;
    case "focus-email-company":
      focusEmailStudioForCompany(id);
      return;
    case "new-template":
      createNewTemplate();
      return;
    case "open-template-import":
      root.querySelector("#template-import-input")?.click();
      return;
    case "open-template-editor":
      openTemplateEditor(id);
      return;
    case "open-draft-editor":
      openDraftEditorFromTemplate(id);
      return;
    case "open-saved-draft":
      openSavedDraft(id);
      return;
    case "refresh-mailbox":
      await loadMailboxMessages();
      return;
    case "open-mailbox-message":
      await openMailboxMessage(id);
      return;
    case "disconnect-gmail":
      try {
        await gmailService.disconnect();
        state.mailbox = {
          ...state.mailbox,
          connected: false,
          emailAddress: "",
          messages: [],
          selectedMessageId: "",
          selectedMessage: null,
          error: ""
        };
        renderApp();
        showToast("Gmail disconnected.");
      } catch (error) {
        showToast(error.message || "Could not disconnect Gmail.");
      }
      return;
    case "close-editor":
      closeEditor();
      return;
    case "switch-editor-tab":
      if (state.editor) {
        state.editor.sidebarTab = id;
        renderApp();
      }
      return;
    case "select-editor-body":
      if (state.editor) {
        state.editor.selectedBlockId = "body";
        renderApp();
      }
      return;
    case "select-editor-block":
      if (state.editor) {
        state.editor.selectedBlockId = id;
        renderApp();
      }
      return;
    case "add-editor-block":
      addBlockToEditor(id);
      return;
    case "trigger-editor-import-file":
      root.querySelector("#editor-import-file")?.click();
      return;
    case "import-editor-html": {
      const importInput = root.querySelector("#editor-import-html");
      const html = importInput?.value || "";
      if (!String(html).trim()) {
        showToast("Paste some HTML first.");
        return;
      }
      replaceEditorWithImportedHtml(html);
      return;
    }
    case "move-block-up":
      moveSelectedBlock(-1);
      return;
    case "move-block-down":
      moveSelectedBlock(1);
      return;
    case "duplicate-block":
      duplicateSelectedBlock();
      return;
    case "delete-block":
      deleteSelectedBlock();
      return;
    case "insert-token":
      insertTokenIntoEditor(id);
      return;
    case "set-editor-device":
      if (state.editor) {
        state.editor.device = id;
        renderApp();
      }
      return;
    case "copy-editor-subject":
      await copyTextToClipboard(buildEditorPreview().subject, "Rendered subject copied.");
      return;
    case "copy-editor-html":
      await copyTextToClipboard(buildEditorPreview().html, "Rendered HTML copied.");
      return;
    case "save-template-editor":
      await saveTemplateFromEditor();
      return;
    case "save-draft-editor":
      await saveDraftFromEditor();
      return;
    case "sign-out":
      await authService.signOut();
      state.companies = [];
      state.templates = [];
      state.drafts = [];
      state.loginError = "";
      state.preferredCompanyId = "";
      state.editor = null;
      renderApp();
      return;
    default:
      return;
  }
});

root.addEventListener("input", (event) => {
  if (event.target.id === "company-search") {
    state.filters.search = event.target.value;
    renderApp();
    return;
  }

  if (event.target.name === "firstContacted") {
    const form = event.target.closest("form");
    const followUpInput = form?.querySelector('[name="nextFollowUp"]');
    const nextFollowUpValue = addDaysToInputDate(event.target.value, 7);

    state.modal.draft = {
      ...state.modal.draft,
      firstContacted: event.target.value,
      nextFollowUp:
        followUpInput?.dataset.autoManaged !== "false" || !followUpInput?.value
          ? nextFollowUpValue
          : state.modal.draft.nextFollowUp
    };

    if (!followUpInput) {
      return;
    }

    const shouldAutoUpdate =
      followUpInput.dataset.autoManaged !== "false" || !followUpInput.value;
    if (!shouldAutoUpdate) {
      return;
    }

    followUpInput.value = nextFollowUpValue;
    followUpInput.dataset.autoManaged = "true";
    return;
  }

  if (event.target.name === "nextFollowUp") {
    event.target.dataset.autoManaged = "false";
    state.modal.draft = {
      ...state.modal.draft,
      nextFollowUp: event.target.value
    };
  }

  if (event.target.closest("#company-form")) {
    const { name, value, type, checked } = event.target;
    if (name === "hasProposalDate") {
      state.modal.draft = {
        ...state.modal.draft,
        hasProposalDate: checked,
        proposalDate: checked ? state.modal.draft.proposalDate || "" : ""
      };
      renderApp();
      return;
    }

    if (name === "hasInterviewDate") {
      state.modal.draft = {
        ...state.modal.draft,
        hasInterviewDate: checked,
        interviewDate: checked ? state.modal.draft.interviewDate || "" : ""
      };
      renderApp();
      return;
    }

    if (name) {
      state.modal.draft = {
        ...state.modal.draft,
        [name]: type === "number" ? Number(value || 0) : value
      };
    }
    return;
  }

  if (!state.editor) {
    return;
  }

  rememberEditorFocus(event.target);

  if (event.target.id === "editor-name") {
    state.editor.nameInput = event.target.value;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (event.target.id === "editor-subject") {
    state.editor.subjectInput = event.target.value;
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (event.target.dataset.editorScope === "canvas") {
    const field = event.target.dataset.editorField;
    state.editor.design.canvas[field] = coerceEditorValue(event.target.value, event.target.type);
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (event.target.dataset.editorScope === "block-content") {
    const field = event.target.dataset.editorField;
    updateSelectedBlock((block) => {
      block.content[field] = event.target.value;
    });
    shouldRestoreEditorFocus = true;
    renderApp();
    return;
  }

  if (event.target.dataset.editorScope === "block-style") {
    const field = event.target.dataset.editorField;
    updateSelectedBlock((block) => {
      block.styles[field] = coerceEditorValue(event.target.value, event.target.type);
    });
    shouldRestoreEditorFocus = true;
    renderApp();
  }
});

root.addEventListener("change", async (event) => {
  if (event.target.id === "status-filter") {
    state.filters.status = event.target.value;
    renderApp();
    return;
  }

  if (event.target.id === "follow-up-template-select") {
    state.calendar.workflow.selectedTemplateId = event.target.value;
    state.calendar.workflow.error = "";
    renderApp();
    return;
  }

  if (event.target.id === "template-import-input") {
    try {
      await importHtmlFile(event.target.files?.[0], "new-template");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not import that HTML template.");
    } finally {
      event.target.value = "";
    }
    return;
  }

  if (event.target.id === "editor-import-file") {
    try {
      await importHtmlFile(event.target.files?.[0], "replace-editor");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not import that HTML into the editor.");
    } finally {
      event.target.value = "";
    }
    return;
  }

  if (!state.editor) {
    return;
  }

  if (event.target.id === "editor-company") {
    state.editor.companyId = event.target.value;
    state.preferredCompanyId =
      event.target.value === PREVIEW_COMPANY.id ? state.preferredCompanyId : event.target.value;
    renderApp();
    return;
  }

  if (event.target.dataset.editorScope === "block-style") {
    const field = event.target.dataset.editorField;
    updateSelectedBlock((block) => {
      block.styles[field] = event.target.value;
    });
    shouldRestoreEditorFocus = true;
    renderApp();
  }
});

root.addEventListener("pointerdown", (event) => {
  if (!state.editor || event.button !== 0) {
    return;
  }

  const layoutTarget = event.target.closest("[data-layout-drag-id]");
  if (!layoutTarget) {
    return;
  }

  event.preventDefault();
  startLayoutDrag(layoutTarget.dataset.layoutDragId, event);
});

window.addEventListener("pointermove", (event) => {
  if (!currentLayoutDrag) {
    return;
  }

  event.preventDefault();
  updateLayoutDrag(event);
});

window.addEventListener("pointerup", () => {
  endLayoutDrag();
});

window.addEventListener("blur", () => {
  endLayoutDrag();
});

root.addEventListener("dragstart", (event) => {
  if (!state.editor) {
    return;
  }

  const dragTarget = event.target.closest("[data-drag-kind]");
  if (!dragTarget) {
    return;
  }

  if (dragTarget.dataset.dragKind === "new-block") {
    currentEditorDrag = {
      kind: "new-block",
      blockType: dragTarget.dataset.blockType || dragTarget.dataset.id
    };
  } else if (dragTarget.dataset.dragKind === "existing-block") {
    currentEditorDrag = {
      kind: "existing-block",
      blockId: dragTarget.dataset.id
    };
  }

  if (!currentEditorDrag) {
    return;
  }

  document.body.classList.add("is-editor-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(currentEditorDrag));
  }
});

root.addEventListener("dragover", (event) => {
  if (!currentEditorDrag) {
    return;
  }

  const dropZone = event.target.closest("[data-drop-index]");
  if (!dropZone) {
    return;
  }

  event.preventDefault();
  setActiveDropZone(dropZone);

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
});

root.addEventListener("drop", (event) => {
  if (!currentEditorDrag) {
    return;
  }

  const dropZone = event.target.closest("[data-drop-index]");
  if (!dropZone) {
    resetEditorDragState();
    return;
  }

  event.preventDefault();
  handleEditorDrop(Number(dropZone.dataset.dropIndex || 0));
  resetEditorDragState();
});

root.addEventListener("dragend", () => {
  resetEditorDragState();
});

root.addEventListener("focusin", (event) => {
  if (isRestoringEditorFocus) {
    return;
  }

  rememberEditorFocus(event.target);
});

root.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "login-form") {
    await handleLoginSubmit(event.target);
    return;
  }

  if (event.target.id === "company-form") {
    await handleCompanySubmit(event.target);
    return;
  }

  if (event.target.id === "mailbox-search-form") {
    const formData = new FormData(event.target);
    state.mailbox.query = String(formData.get("query") || "");
    await loadMailboxMessages();
    return;
  }

  if (event.target.id === "gmail-compose-form") {
    const formData = new FormData(event.target);

    try {
      await gmailService.sendMessage({
        to: String(formData.get("to") || ""),
        subject: String(formData.get("subject") || ""),
        htmlBody: String(formData.get("htmlBody") || "")
      });
      event.target.reset();
      await loadMailboxMessages(false);
      showToast("Email sent from Gmail.");
    } catch (error) {
      showToast(error.message || "Could not send Gmail message.");
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentLayoutDrag) {
    endLayoutDrag();
    return;
  }

  if (event.key === "Escape" && state.calendar.workflow.open) {
    closeFollowUpWorkflow();
    return;
  }

  if (event.key === "Escape" && state.modal.open) {
    closeModal();
    return;
  }

  if (event.key === "Escape" && state.editor?.open) {
    closeEditor();
  }
});

init();
