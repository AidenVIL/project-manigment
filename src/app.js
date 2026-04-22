import { APP_CONFIG, isSupabaseConfigured } from "./config/runtime-config.js";
import { createCompany } from "./models/company-model.js";
import { authService } from "./services/auth-service.js";
import { buildCalendarEvents, buildCalendarSummary } from "./services/calendar-service.js";
import { companyService } from "./services/company-service.js";
import { buildDashboardSnapshot } from "./services/dashboard-service.js";
import { draftService } from "./services/draft-service.js";
import { gmailService } from "./services/gmail-service.js";
import { templateService } from "./services/template-service.js";
import { renderCompanyModal } from "./ui/components/modal.js";
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
    companyId: ""
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
  preferredCompanyId: "",
  editor: null,
  toast: ""
};

let toastTimer = null;
let shouldRestoreEditorFocus = false;

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

function getModalCompany() {
  if (!state.modal.companyId) {
    return {
      ...createCompany(),
      id: ""
    };
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
      tokens: {}
    };
  }

  return templateService.previewTemplate(
    {
      subject: editor.subjectInput,
      design: editor.design
    },
    getEditorCompany(editor)
  );
}

function buildFocusSnapshot(target, base = {}) {
  const snapshot = { ...base };

  if (typeof target.selectionStart === "number" && typeof target.selectionEnd === "number") {
    snapshot.selectionStart = target.selectionStart;
    snapshot.selectionEnd = target.selectionEnd;
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

  const selector = getEditorFocusSelector(state.editor.lastFocusedTarget);
  if (!selector) {
    return;
  }

  const input = root.querySelector(selector);
  if (!input) {
    return;
  }

  input.focus({ preventScroll: true });

  if (
    typeof state.editor.lastFocusedTarget.selectionStart === "number" &&
    typeof state.editor.lastFocusedTarget.selectionEnd === "number" &&
    typeof input.setSelectionRange === "function"
  ) {
    input.setSelectionRange(
      state.editor.lastFocusedTarget.selectionStart,
      state.editor.lastFocusedTarget.selectionEnd
    );
  }
}

function renderShell() {
  const filteredCompanies = getFilteredCompanies();
  const snapshot = buildDashboardSnapshot(state.companies, APP_CONFIG.fundraisingTarget);
  const events = buildCalendarEvents(state.companies);
  const summary = buildCalendarSummary(events);
  const modeLabel = isLiveMode() ? "Live Supabase mode" : "Demo mode";

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
        ${renderCalendarView({ events, summary })}
        ${renderMailboxView({
          mailbox: state.mailbox
        })}
        ${renderEmailStudioView({
          templates: state.templates,
          drafts: state.drafts
        })}
      </main>
      ${renderCompanyModal(state.modal, getModalCompany())}
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
      restoreEditorFocus();
      shouldRestoreEditorFocus = false;
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
  renderApp();
}

function openCompanyModal(companyId = "") {
  state.modal.open = true;
  state.modal.companyId = companyId;
  renderApp();
}

function closeEditor() {
  state.editor = null;
  renderApp();
}

function focusEmailStudioForCompany(companyId) {
  state.preferredCompanyId = companyId;
  renderApp();
  document.querySelector("#emails")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Draft mode will now default to that company.");
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

function findSelectedBlock() {
  if (!state.editor || state.editor.selectedBlockId === "body") {
    return null;
  }

  return (
    state.editor.design.blocks.find((block) => block.id === state.editor.selectedBlockId) || null
  );
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
  payload.askValue = Number(payload.askValue || 0);
  payload.contributionValue = Number(payload.contributionValue || 0);
  payload.lastUpdated = new Date().toISOString();

  try {
    const savedCompany = await companyService.saveCompany(payload);
    state.companies = await companyService.loadCompanies();
    state.preferredCompanyId = savedCompany.id;
    syncEditorCompanyOptions();
    closeModal();
    showToast(`${savedCompany.companyName} saved.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save company.");
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
    case "move-block-up":
      moveSelectedBlock(-1);
      return;
    case "move-block-down":
      moveSelectedBlock(1);
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
    if (!followUpInput) {
      return;
    }

    const shouldAutoUpdate =
      followUpInput.dataset.autoManaged !== "false" || !followUpInput.value;
    if (!shouldAutoUpdate) {
      return;
    }

    followUpInput.value = addDaysToInputDate(event.target.value, 7);
    followUpInput.dataset.autoManaged = "true";
    return;
  }

  if (event.target.name === "nextFollowUp") {
    event.target.dataset.autoManaged = "false";
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

root.addEventListener("change", (event) => {
  if (event.target.id === "status-filter") {
    state.filters.status = event.target.value;
    renderApp();
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

root.addEventListener("focusin", (event) => {
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
  if (event.key === "Escape" && state.modal.open) {
    closeModal();
    return;
  }

  if (event.key === "Escape" && state.editor?.open) {
    closeEditor();
  }
});

init();
