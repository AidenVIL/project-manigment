import { APP_CONFIG, isSupabaseConfigured } from "./config/runtime-config.js";
import { createCompany } from "./models/company-model.js";
import { createTemplate } from "./models/template-model.js";
import { authService } from "./services/auth-service.js";
import { buildCalendarEvents, buildCalendarSummary } from "./services/calendar-service.js";
import { companyService } from "./services/company-service.js";
import { buildDashboardSnapshot } from "./services/dashboard-service.js";
import {
  getBuilderActionMarkup,
  getTemplateBlockMarkup,
  templateService
} from "./services/template-service.js";
import { renderCompanyModal } from "./ui/components/modal.js";
import { renderAuthView } from "./ui/views/auth-view.js";
import { renderCalendarView } from "./ui/views/calendar-view.js";
import { renderCompaniesView } from "./ui/views/companies-view.js";
import { renderDashboardView } from "./ui/views/dashboard-view.js";
import { renderEmailStudioView } from "./ui/views/email-studio-view.js";
import { addDaysToInputDate } from "./utils/date-utils.js";
import { escapeHtml } from "./utils/formatters.js";

const root = document.querySelector("#app");

const state = {
  loading: true,
  loginError: "",
  companies: [],
  templates: [],
  filters: {
    search: "",
    status: "all"
  },
  modal: {
    open: false,
    companyId: ""
  },
  emailStudio: {
    selectedCompanyId: "",
    selectedTemplateId: "",
    subjectInput: "",
    htmlInput: ""
  },
  toast: ""
};

let toastTimer = null;

function isLiveMode() {
  return isSupabaseConfigured();
}

function isPasswordGateEnabled() {
  return Boolean(APP_CONFIG.sitePassword);
}

function getSelectedCompany() {
  return (
    state.companies.find((company) => company.id === state.emailStudio.selectedCompanyId) ||
    state.companies[0] ||
    createCompany()
  );
}

function getSelectedTemplate() {
  return (
    state.templates.find((template) => template.id === state.emailStudio.selectedTemplateId) ||
    state.templates[0] ||
    createTemplate()
  );
}

function getModalCompany() {
  if (!state.modal.companyId) {
    return {
      ...createCompany(),
      id: ""
    };
  }

  return (
    state.companies.find((company) => company.id === state.modal.companyId) || createCompany()
  );
}

function syncEditorFromSelectedTemplate() {
  const template = getSelectedTemplate();
  state.emailStudio.subjectInput = template.subject || "";
  state.emailStudio.htmlInput = template.html || "";
}

function ensureSelections() {
  if (!state.emailStudio.selectedCompanyId && state.companies[0]) {
    state.emailStudio.selectedCompanyId = state.companies[0].id;
  }

  if (!state.emailStudio.selectedTemplateId && state.templates[0]) {
    state.emailStudio.selectedTemplateId = state.templates[0].id;
    syncEditorFromSelectedTemplate();
  }
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

function buildPreview() {
  return templateService.previewTemplate(
    {
      ...getSelectedTemplate(),
      subject: state.emailStudio.subjectInput,
      html: state.emailStudio.htmlInput
    },
    getSelectedCompany()
  );
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

function renderShell() {
  const filteredCompanies = getFilteredCompanies();
  const snapshot = buildDashboardSnapshot(state.companies, APP_CONFIG.fundraisingTarget);
  const events = buildCalendarEvents(state.companies);
  const summary = buildCalendarSummary(events);
  const preview = buildPreview();
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
        ${renderEmailStudioView({
          companies: state.companies,
          templates: state.templates,
          selectedCompanyId: state.emailStudio.selectedCompanyId,
          selectedTemplateId: state.emailStudio.selectedTemplateId,
          subjectInput: state.emailStudio.subjectInput,
          htmlInput: state.emailStudio.htmlInput,
          preview
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
    ensureSelections();
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

function focusEmailStudioForCompany(companyId) {
  state.emailStudio.selectedCompanyId = companyId;
  renderApp();
  document.querySelector("#emails")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    state.emailStudio.selectedCompanyId = savedCompany.id;
    closeModal();
    showToast(`${savedCompany.companyName} saved.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save company.");
  }
}

async function saveTemplateFromEditor() {
  const selectedTemplate = getSelectedTemplate();
  const templateName = selectedTemplate.name || `Template ${state.templates.length + 1}`;

  try {
    const savedTemplate = await templateService.saveTemplate({
      ...selectedTemplate,
      name: templateName,
      subject: state.emailStudio.subjectInput,
      html: state.emailStudio.htmlInput
    });

    state.templates = await templateService.loadTemplates();
    state.emailStudio.selectedTemplateId = savedTemplate.id;
    syncEditorFromSelectedTemplate();
    renderApp();
    showToast(`${savedTemplate.name} saved.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save template.");
  }
}

async function createNewTemplate() {
  try {
    const template = templateService.createStarterTemplate(state.templates.length + 1);
    const savedTemplate = await templateService.saveTemplate(template);
    state.templates = await templateService.loadTemplates();
    state.emailStudio.selectedTemplateId = savedTemplate.id;
    syncEditorFromSelectedTemplate();
    renderApp();
    showToast(`${savedTemplate.name} created.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not create template.");
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

function insertIntoTextArea(textArea, snippet) {
  const currentValue = textArea.value;
  const selectionStart = textArea.selectionStart ?? currentValue.length;
  const selectionEnd = textArea.selectionEnd ?? currentValue.length;
  const selectedText = currentValue.slice(selectionStart, selectionEnd);
  const nextSnippet = typeof snippet === "function" ? snippet(selectedText) : snippet;
  const nextValue =
    currentValue.slice(0, selectionStart) +
    nextSnippet +
    currentValue.slice(selectionEnd);

  textArea.value = nextValue;
  state.emailStudio.htmlInput = nextValue;
  renderApp();

  const refreshed = document.querySelector("#template-html");
  if (refreshed) {
    const nextCursor = selectionStart + nextSnippet.length;
    refreshed.focus();
    refreshed.setSelectionRange(nextCursor, nextCursor);
  }
}

root.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    const { action, id } = actionTarget.dataset;

    switch (action) {
      case "open-add-company":
        openCompanyModal();
        break;
      case "close-modal":
        closeModal();
        break;
      case "edit-company":
        openCompanyModal(id);
        break;
      case "delete-company":
        if (!window.confirm("Delete this company record?")) {
          return;
        }

        try {
          await companyService.deleteCompany(id);
          state.companies = await companyService.loadCompanies();
          if (state.emailStudio.selectedCompanyId === id) {
            state.emailStudio.selectedCompanyId = state.companies[0]?.id || "";
          }
          renderApp();
          showToast("Company deleted.");
        } catch (error) {
          console.error(error);
          showToast(error.message || "Could not delete company.");
        }
        break;
      case "focus-email-company":
        focusEmailStudioForCompany(id);
        break;
      case "save-template":
        await saveTemplateFromEditor();
        break;
      case "new-template":
        await createNewTemplate();
        break;
      case "copy-subject":
        await copyTextToClipboard(state.emailStudio.subjectInput, "Subject copied.");
        break;
      case "copy-html":
        await copyTextToClipboard(state.emailStudio.htmlInput, "HTML copied.");
        break;
      case "sign-out":
        await authService.signOut();
        state.companies = [];
        state.templates = [];
        state.loginError = "";
        state.emailStudio = {
          selectedCompanyId: "",
          selectedTemplateId: "",
          subjectInput: "",
          htmlInput: ""
        };
        renderApp();
        break;
      default:
        break;
    }
    return;
  }

  const blockButton = event.target.closest("[data-template-block]");
  if (blockButton) {
    const textArea = document.querySelector("#template-html");
    if (!textArea) {
      return;
    }

    const markup = getTemplateBlockMarkup(blockButton.dataset.templateBlock);
    insertIntoTextArea(textArea, `${textArea.value ? "\n\n" : ""}${markup}`);
    return;
  }

  const toolButton = event.target.closest("[data-template-action]");
  if (toolButton) {
    const textArea = document.querySelector("#template-html");
    if (!textArea) {
      return;
    }

    insertIntoTextArea(textArea, (selectedText) =>
      getBuilderActionMarkup(toolButton.dataset.templateAction, selectedText)
    );
  }
});

root.addEventListener("input", (event) => {
  if (event.target.id === "company-search") {
    state.filters.search = event.target.value;
    renderApp();
  }

  if (event.target.id === "template-subject") {
    state.emailStudio.subjectInput = event.target.value;
    renderApp();
  }

  if (event.target.id === "template-html") {
    state.emailStudio.htmlInput = event.target.value;
    renderApp();
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
  }

  if (event.target.name === "nextFollowUp") {
    event.target.dataset.autoManaged = "false";
  }
});

root.addEventListener("change", (event) => {
  if (event.target.id === "status-filter") {
    state.filters.status = event.target.value;
    renderApp();
  }

  if (event.target.id === "template-select") {
    state.emailStudio.selectedTemplateId = event.target.value;
    syncEditorFromSelectedTemplate();
    renderApp();
  }

  if (event.target.id === "company-select") {
    state.emailStudio.selectedCompanyId = event.target.value;
    renderApp();
  }
});

root.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "login-form") {
    await handleLoginSubmit(event.target);
  }

  if (event.target.id === "company-form") {
    await handleCompanySubmit(event.target);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal.open) {
    closeModal();
  }
});

init();
