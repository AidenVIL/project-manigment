import { APP_CONFIG, isSupabaseConfigured } from "./config/runtime-config.js";
import { askTypeOptions, createCompany, getOptionLabel } from "./models/company-model.js";
import { accountService } from "./services/account-service.js";
import { authService } from "./services/auth-service.js";
import { askCompanyAssistant } from "./services/company-chat-service.js";
import { atomicIntelligenceService } from "./services/atomic-intelligence-service.js";
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
import { supabaseService } from "./services/supabase-service.js";
import { analyzeEmailWriting } from "./services/writing-coach-service.js";
import { renderCompanyModal } from "./ui/components/modal.js";
import { renderFollowUpWorkflowModal } from "./ui/components/follow-up-workflow-modal.js";
import { renderAuthView } from "./ui/views/auth-view.js";
import { renderCalendarView } from "./ui/views/calendar-view.js";
import { renderCompaniesView } from "./ui/views/companies-view.js";
import { renderDashboardView } from "./ui/views/dashboard-view.js";
import { renderMailboxView } from "./ui/views/mailbox-view.js";
import { renderAccountsView } from "./ui/views/accounts-view.js";
import { renderTemplateEditorView } from "./ui/views/template-editor-view.js";
import { renderEmailStudioView } from "./ui/views/template-hub-view.js";
import { renderAtomicIntelligenceView } from "./ui/views/atomic-intelligence-view.js";
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

const workspaceViews = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Command View",
    title: "Fundraising control centre",
    description: "Track progress, partner mix, and the current shape of the sponsor pipeline."
  },
  {
    id: "companies",
    label: "Companies",
    eyebrow: "Sponsor CRM",
    title: "Company pipeline",
    description: "Manage sponsor targets, outreach state, follow-ups, and contribution details."
  },
  {
    id: "calendar",
    label: "Calendar",
    eyebrow: "Deadlines",
    title: "Follow-up schedule",
    description: "See milestone dates, interviews, and the next actions due across the pipeline."
  },
  {
    id: "mailbox",
    label: "Mailbox",
    eyebrow: "Inbox",
    title: "Shared outreach inbox",
    description: "Search the team mailbox, review incoming replies, and send direct follow-ups."
  },
  {
    id: "accounts",
    label: "Accounts",
    eyebrow: "Access",
    title: "Team usernames",
    description: "Pre-add teammate usernames and manage first-login password setup."
  },
  {
    id: "emails",
    label: "Email Studio",
    eyebrow: "Templates",
    title: "Email templates and drafts",
    description: "Build master templates, spin up one-off drafts, and keep outreach copy consistent."
  },
  {
    id: "intelligence",
    label: "Atomic Intelligence",
    eyebrow: "AI",
    title: "AI command workspace",
    description: "Run Pi-friendly AI chat, free web research, sponsor targeting, and saved strategic notes."
  }
];

const state = {
  loading: true,
  loginError: "",
  companies: [],
  templates: [],
  drafts: [],
  filters: {
    search: "",
    status: "all",
    responseStatus: "all",
    askType: "all",
    sortBy: "updated_desc"
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
    companySearchMode: "company",
    finderCompanyName: "",
    finderWebsite: "",
    finderContext: "",
    contactDraftEmail: "",
    selectedModalContactId: "",
    selectedCompanyCandidateId: "",
    appliedCompanyCandidateId: "",
    completedResearchEntries: []
  },
  assistant: {
    open: false,
    input: "",
    loading: false,
    messages: [
      {
        role: "assistant",
        text: "Hi, I’m your sponsor assistant. Ask me about tracked companies, follow-ups, or top-value targets."
      }
    ]
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
  accounts: {
    loading: false,
    users: [],
    error: ""
  },
  auth: {
    mode: "login",
    setupUsername: ""
  },
  supabaseConnection: {
    checking: false,
    status: "idle",
    message: ""
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
  workspaceView: "overview",
  preferredCompanyId: "",
  editor: null,
  toast: "",
  intelligence: {
    activeTab: "chat",
    input: "",
    loading: false,
    error: "",
    messages: []
  }
};

let toastTimer = null;
let shouldRestoreEditorFocus = false;
let currentEditorDrag = null;
let activeDropZone = null;
let currentLayoutDrag = null;
let pendingFocusRestoreFrame = null;
let isRestoringEditorFocus = false;
let pendingCompanySearchFocusRestoreFrame = null;
let companySearchFocusSnapshot = null;

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

function getCompanyContacts(company = PREVIEW_COMPANY) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  if (contacts.length) {
    return contacts.map((contact) => ({
      id: contact.id || crypto.randomUUID(),
      name: contact.name || "",
      role: contact.role || "",
      email: contact.email || ""
    }));
  }

  if (company.contactName || company.contactRole || company.contactEmail) {
    return [
      {
        id: "primary-legacy-contact",
        name: company.contactName || "",
        role: company.contactRole || "",
        email: company.contactEmail || ""
      }
    ];
  }

  return [];
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

function getWorkspaceView() {
  return workspaceViews.find((view) => view.id === state.workspaceView) || workspaceViews[0];
}

function setWorkspaceView(viewId) {
  if (!workspaceViews.some((view) => view.id === viewId)) {
    return;
  }

  state.workspaceView = viewId;
}

function getFilteredCompanies() {
  const searchQuery = state.filters.search.trim().toLowerCase();
  const filtered = state.companies.filter((company) => {
    const contactsHaystack = (company.contacts || [])
      .map((contact) => `${contact.name || ""} ${contact.role || ""} ${contact.email || ""}`)
      .join(" ")
      .toLowerCase();
    const matchesStatus = state.filters.status === "all" || company.status === state.filters.status;
    const matchesResponseStatus =
      state.filters.responseStatus === "all" || company.responseStatus === state.filters.responseStatus;
    const matchesAskType = state.filters.askType === "all" || company.askType === state.filters.askType;
    const matchesSearch =
      !searchQuery ||
      company.companyName.toLowerCase().includes(searchQuery) ||
      company.contactName.toLowerCase().includes(searchQuery) ||
      company.contactEmail.toLowerCase().includes(searchQuery) ||
      company.sector.toLowerCase().includes(searchQuery) ||
      contactsHaystack.includes(searchQuery);

    return matchesStatus && matchesResponseStatus && matchesAskType && matchesSearch;
  });

  const sorted = [...filtered];
  switch (state.filters.sortBy) {
    case "alpha_asc":
      sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
      break;
    case "alpha_desc":
      sorted.sort((a, b) => b.companyName.localeCompare(a.companyName));
      break;
    case "next_follow_up":
      sorted.sort((a, b) => String(a.nextFollowUp || "9999-12-31").localeCompare(String(b.nextFollowUp || "9999-12-31")));
      break;
    case "ask_desc":
      sorted.sort((a, b) => Number(b.askValue || 0) - Number(a.askValue || 0));
      break;
    case "confirmed_desc":
      sorted.sort((a, b) => Number(b.contributionValue || 0) - Number(a.contributionValue || 0));
      break;
    case "updated_desc":
    default:
      sorted.sort((a, b) => String(b.lastUpdated || b.updatedAt || "").localeCompare(String(a.lastUpdated || a.updatedAt || "")));
      break;
  }

  return sorted;
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
  state.modal.companySearchMode = "company";
  state.modal.finderCompanyName = "";
  state.modal.finderWebsite = "";
  state.modal.finderContext = "";
  state.modal.contactDraftEmail = "";
  state.modal.selectedModalContactId = "";
  state.modal.selectedCompanyCandidateId = "";
  state.modal.appliedCompanyCandidateId = "";
  state.modal.completedResearchEntries = [];
}

function applyResearchSuggestionsToDraft(result) {
  if (!result) {
    return;
  }

  const topContact = result.contacts?.[0] || null;
  const topEmail = result.emails?.[0] || null;
  const seededContacts = [];
  if (topContact || topEmail) {
    seededContacts.push({
      id: crypto.randomUUID(),
      name: topContact?.name || "",
      role: topContact?.role || "",
      email: topEmail?.email || "",
      source: topEmail?.source || topContact?.source || "",
      matchReason: topEmail?.matchReason || ""
    });
  }
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
    contacts: state.modal.draft.contacts?.length ? state.modal.draft.contacts : seededContacts,
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
    companyCandidates: result.companyCandidates || [],
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

  const baseCandidates = result.emailMatches?.length ? result.emailMatches : result.emails || [];

  return baseCandidates.map((entry, index) => {
    const matchingContact =
      (result.contacts || []).find((contact) => contact.source === entry.source) || null;
    return {
      id: entry.id || `${entry.email || "email"}-${index}`,
      email: entry.email || "",
      source: entry.source || "",
      areaLabel: entry.areaLabel || getResearchSourceLabel(result, entry.source),
      contactName: entry.contactName || matchingContact?.name || "",
      contactRole: entry.contactRole || matchingContact?.role || "",
      matchReason: entry.matchReason || ""
    };
  });
}

function applyResearchCandidate(candidate) {
  if (!candidate) {
    return;
  }
  const existingContacts = Array.isArray(state.modal.draft.contacts)
    ? [...state.modal.draft.contacts]
    : [];
  const normalizedEmail = String(candidate.email || "").trim().toLowerCase();
  const normalizedName = String(candidate.contactName || "").trim().toLowerCase();
  const existingIndex = existingContacts.findIndex((entry) => {
    const entryEmail = String(entry.email || "").trim().toLowerCase();
    const entryName = String(entry.name || "").trim().toLowerCase();
    if (normalizedEmail && entryEmail) {
      return normalizedEmail === entryEmail;
    }
    return normalizedName && entryName && normalizedName === entryName;
  });

  const nextContact = {
    id: existingContacts[existingIndex]?.id || crypto.randomUUID(),
    name: candidate.contactName || "",
    role: candidate.contactRole || "",
    email: candidate.email || "",
    source: candidate.source || "",
    matchReason: candidate.matchReason || ""
  };

  if (existingIndex >= 0) {
    existingContacts[existingIndex] = {
      ...existingContacts[existingIndex],
      ...nextContact,
      name: nextContact.name || existingContacts[existingIndex].name || "",
      role: nextContact.role || existingContacts[existingIndex].role || "",
      email: nextContact.email || existingContacts[existingIndex].email || ""
    };
  } else {
    existingContacts.push(nextContact);
  }

  const primaryContact = existingContacts[0] || nextContact;

  state.modal.draft = createCompany({
    ...state.modal.draft,
    contacts: existingContacts,
    contactName: state.modal.draft.contactName || primaryContact.name || "",
    contactRole: state.modal.draft.contactRole || primaryContact.role || "",
    contactEmail: state.modal.draft.contactEmail || primaryContact.email || "",
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

function setPrimaryContactById(contactId = "") {
  const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
  const index = contacts.findIndex((entry) => entry.id === contactId);
  if (index < 0) {
    return;
  }

  const [primary] = contacts.splice(index, 1);
  contacts.unshift(primary);
  state.modal.draft = createCompany({
    ...state.modal.draft,
    contacts,
    contactName: primary.name || "",
    contactRole: primary.role || "",
    contactEmail: primary.email || ""
  });
  state.modal.selectedModalContactId = primary.id || "";
}

function removeContactById(contactId = "") {
  const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
  const nextContacts = contacts.filter((entry) => entry.id !== contactId);
  const nextPrimary = nextContacts[0] || { name: "", role: "", email: "" };
  state.modal.draft = createCompany({
    ...state.modal.draft,
    contacts: nextContacts,
    contactName: nextPrimary.name || "",
    contactRole: nextPrimary.role || "",
    contactEmail: nextPrimary.email || ""
  });
  state.modal.selectedModalContactId = nextContacts[0]?.id || "";
}

function addContactEmailToDraft(rawEmail = "") {
  const email = String(rawEmail || "").trim();
  if (!email) {
    return { ok: false, reason: "empty" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { ok: false, reason: "invalid" };
  }

  const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
  const existing = contacts.find((entry) => String(entry.email || "").trim().toLowerCase() === email.toLowerCase());
  if (existing) {
    state.modal.selectedModalContactId = existing.id;
    return { ok: false, reason: "exists" };
  }

  const newContact = {
    id: crypto.randomUUID(),
    name: "",
    role: "",
    email,
    source: "manual",
    matchReason: "Added manually"
  };
  contacts.push(newContact);

  const currentPrimary = contacts[0] || newContact;
  state.modal.draft = createCompany({
    ...state.modal.draft,
    contacts,
    contactName: state.modal.draft.contactName || currentPrimary.name || "",
    contactRole: state.modal.draft.contactRole || currentPrimary.role || "",
    contactEmail: state.modal.draft.contactEmail || currentPrimary.email || ""
  });
  state.modal.selectedModalContactId = newContact.id;
  state.modal.contactDraftEmail = "";
  return { ok: true };
}

function updateSelectedModalContactField(field, value) {
  const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
  if (!contacts.length) {
    return;
  }

  const selectedId = state.modal.selectedModalContactId || contacts[0]?.id;
  const index = contacts.findIndex((entry) => entry.id === selectedId);
  if (index < 0) {
    return;
  }

  contacts[index] = {
    ...contacts[index],
    [field]: String(value || "")
  };

  const primary = contacts[0] || { name: "", role: "", email: "" };
  state.modal.draft = createCompany({
    ...state.modal.draft,
    contacts,
    contactName: primary.name || "",
    contactRole: primary.role || "",
    contactEmail: primary.email || ""
  });
}

function getSelectedResearchCompanyCandidate() {
  const candidates = state.modal.researchResult?.companyCandidates || [];
  if (!candidates.length) {
    return null;
  }

  return (
    candidates.find((entry) => entry.id === state.modal.selectedCompanyCandidateId) ||
    candidates[0] ||
    null
  );
}

function previewResearchCompanyCandidate(candidate) {
  if (!candidate) {
    return;
  }

  state.modal.selectedCompanyCandidateId = candidate.id || "";
}

function applyResearchCompanyCandidate(candidate) {
  if (!candidate) {
    return;
  }

  previewResearchCompanyCandidate(candidate);
  state.modal.draft = createCompany({
    ...state.modal.draft,
    companyName: candidate.companyName || state.modal.draft.companyName,
    website: candidate.website || state.modal.draft.website,
    sector: candidate.industry || candidate.sector || state.modal.draft.sector,
    researchSummary: candidate.fullSummary || candidate.summaryLine || state.modal.draft.researchSummary,
    personalizationNotes: candidate.sponsorSignalsLine || state.modal.draft.personalizationNotes
  });
  state.modal.appliedCompanyCandidateId = candidate.id;
}

function extractCompanyQueryForAssistant(question = "") {
  const text = String(question || "").trim();
  if (!text) {
    return "";
  }

  const directPatterns = [
    /(?:about|research|summari[sz]e|summary on|info on)\s+([a-z0-9&.,' -]{3,})$/i,
    /(?:company|brand)\s+([a-z0-9&.,' -]{3,})$/i,
    /(?:does|do|can|will)\s+(.+?)\s+(?:offer|provide|have|sponsor|support)\s+(?:sponsorships?|sponsorship|sponsorship opportunities|partners?|sponsor|support)(?:\?|\s*)$/i,
    /(?:does|do|can|will)\s+(.+?)\s+(?:sponsor|support)\b/i
  ];

  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return String(match[1]).trim();
    }
  }

  const cleaned = text
    .replace(/\b(?:tell me|about|research|summarise|summarize|company|brand|please|for|does|do|can|will|offer|provide|have|sponsor|support|sponsorships?|sponsorship|sponsorship opportunities|partners?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 ? cleaned : "";
}

async function handleAssistantQuestion(question = "") {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) {
    return;
  }

  state.assistant.loading = true;
  state.assistant.messages.push({
    role: "user",
    text: cleanQuestion
  });
  state.assistant.input = "";
  renderApp();

  try {
    const response = askCompanyAssistant({
      question: cleanQuestion,
      companies: state.companies
    });
    let finalAnswer = response.answer || "I couldn't produce a useful answer yet.";

    if (response.needsLookup) {
      const companyQuery = extractCompanyQueryForAssistant(cleanQuestion);
      if (companyQuery) {
        try {
          const lookup = await companyResearchService.researchCompany({
            companyName: companyQuery,
            context: "sponsor contact and company summary",
            searchMode: "company",
            companySearchMode: "company"
          });

          const top = lookup.companyCandidates?.[0] || null;
          if (top) {
            finalAnswer = [
              `I found a likely match: ${top.companyName || "Company"}${top.website ? ` (${top.website})` : ""}.`,
              top.summaryLine || top.snippet || "",
              top.sponsorSignalsLine ? `Sponsor signals: ${top.sponsorSignalsLine}` : ""
            ]
              .filter(Boolean)
              .join(" ");
          }
        } catch {
          // Keep base assistant response if live lookup fails.
        }
      }
    }

    state.assistant.messages.push({
      role: "assistant",
      text: finalAnswer
    });
  } catch (error) {
    state.assistant.messages.push({
      role: "assistant",
      text: error.message || "Sorry, I hit an issue answering that."
    });
  } finally {
    state.assistant.loading = false;
    renderApp();
  }
}

async function handleIntelligenceQuestion(question = "") {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion || state.intelligence.loading) {
    return;
  }

  state.intelligence.loading = true;
  state.intelligence.error = "";
  state.intelligence.messages.push({
    role: "user",
    text: cleanQuestion
  });
  state.intelligence.input = "";
  renderApp();

  try {
    const payload = await atomicIntelligenceService.chat({
      question: cleanQuestion,
      mode: state.intelligence.activeTab,
      companies: state.companies
    });

    const answerText = payload?.answer || "I couldn't produce a useful result yet.";
    state.intelligence.messages.push({
      role: "assistant",
      text: answerText
    });
    atomicIntelligenceService.saveHistory(state.intelligence.messages);
  } catch (error) {
    state.intelligence.error = error.message || "Atomic Intelligence could not complete that request.";
    state.intelligence.messages.push({
      role: "assistant",
      text: `I hit an issue: ${state.intelligence.error}`
    });
    atomicIntelligenceService.saveHistory(state.intelligence.messages);
  } finally {
    state.intelligence.loading = false;
    renderApp();
  }
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
  lastFocusedTarget = null,
  selectedContactIds = []
}) {
  const companyOptions = getCompanyOptions();
  const resolvedCompanyId =
    companyOptions.find((option) => option.id === companyId)?.id || companyOptions[0]?.id || "";
  const resolvedCompany =
    state.companies.find((company) => company.id === resolvedCompanyId) || PREVIEW_COMPANY;
  const availableContacts = getCompanyContacts(resolvedCompany);
  const normalizedSelectedContactIds = (Array.isArray(selectedContactIds) ? selectedContactIds : []).filter(
    (idValue) => availableContacts.some((contact) => contact.id === idValue)
  );
  const initialSelectedContactIds = normalizedSelectedContactIds.length
    ? normalizedSelectedContactIds
    : availableContacts[0]?.id
      ? [availableContacts[0].id]
      : [];

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
    selectedContactIds: initialSelectedContactIds,
    aiAssistMode: "first_outreach",
    aiAssistPrompt: "",
    aiAssistLoading: false,
    aiAssistError: "",
    aiAssistResult: null,
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

  const company = getEditorCompany(state.editor);
  const contacts = getCompanyContacts(company);
  state.editor.selectedContactIds = (state.editor.selectedContactIds || []).filter((contactId) =>
    contacts.some((contact) => contact.id === contactId)
  );
  if (!state.editor.selectedContactIds.length && contacts[0]?.id) {
    state.editor.selectedContactIds = [contacts[0].id];
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

function extractPlainTextFromEditorDesign(design = {}) {
  const blocks = Array.isArray(design?.blocks) ? design.blocks : [];
  return blocks
    .map((block) => String(block?.content?.text || block?.content?.label || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function ensureParagraphTargetBlock() {
  const selected = findSelectedBlock();
  if (selected && (selected.type === "paragraph" || selected.type === "heading")) {
    return selected;
  }

  const firstParagraph = state.editor?.design?.blocks?.find((block) => block.type === "paragraph");
  if (firstParagraph) {
    state.editor.selectedBlockId = firstParagraph.id;
    return firstParagraph;
  }

  const added = templateService.createBlockInstance("paragraph");
  added.content.text = "";
  state.editor.design.blocks.push(added);
  state.editor.selectedBlockId = added.id;
  return added;
}

async function runEditorAiAssist() {
  if (!state.editor || state.editor.aiAssistLoading) {
    return;
  }

  const company = getEditorCompany(state.editor);
  const contacts = getCompanyContacts(company);
  const selectedContact = contacts.find((contact) => (state.editor.selectedContactIds || []).includes(contact.id)) || contacts[0] || {};
  const preview = buildEditorPreview(state.editor);

  state.editor.aiAssistLoading = true;
  state.editor.aiAssistError = "";
  renderApp();

  try {
    const result = await atomicIntelligenceService.assistEmail({
      mode: state.editor.aiAssistMode || "first_outreach",
      company,
      contact: selectedContact,
      subject: preview.subject || state.editor.subjectInput || "",
      html: preview.html || "",
      plainText: extractPlainTextFromEditorDesign(state.editor.design),
      instruction: state.editor.aiAssistPrompt || ""
    });

    state.editor.aiAssistResult = result || null;
    if (result?.subjectSuggestion) {
      state.editor.subjectInput = result.subjectSuggestion;
    }
  } catch (error) {
    state.editor.aiAssistError = error.message || "AI assist failed.";
  } finally {
    state.editor.aiAssistLoading = false;
    renderApp();
  }
}

function applyEditorAiFullDraft() {
  if (!state.editor?.aiAssistResult?.replacementBody) {
    return;
  }
  const target = ensureParagraphTargetBlock();
  target.content.text = String(state.editor.aiAssistResult.replacementBody || "");
  showToast("AI draft applied.");
  renderApp();
}

function applyEditorAiContinuation() {
  if (!state.editor?.aiAssistResult?.continuation) {
    return;
  }
  const target = ensureParagraphTargetBlock();
  const current = String(target.content.text || "").trim();
  const continuation = String(state.editor.aiAssistResult.continuation || "").trim();
  target.content.text = current ? `${current} ${continuation}` : continuation;
  showToast("Continuation added.");
  renderApp();
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

function restoreCompanySearchFocus() {
  if (!companySearchFocusSnapshot) {
    return;
  }

  const input = root.querySelector("#company-search");
  if (!input) {
    return;
  }

  const focusTarget = { ...companySearchFocusSnapshot };
  companySearchFocusSnapshot = null;

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
  } finally {
    // Nothing else needed here.
  }
}

function scheduleCompanySearchFocusRestore() {
  if (pendingCompanySearchFocusRestoreFrame) {
    window.cancelAnimationFrame(pendingCompanySearchFocusRestoreFrame);
  }

  pendingCompanySearchFocusRestoreFrame = window.requestAnimationFrame(() => {
    restoreCompanySearchFocus();
    pendingCompanySearchFocusRestoreFrame = null;
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
  const activeView = getWorkspaceView();
  const currentUser = authService.getUser();
  const activeWorkspaceMarkup =
    activeView.id === "overview"
      ? renderDashboardView({ config: APP_CONFIG, snapshot })
      : activeView.id === "companies"
        ? renderCompaniesView({
            filters: state.filters,
            companies: filteredCompanies,
            totalCompanies: state.companies.length
          })
        : activeView.id === "calendar"
        ? renderCalendarView({ events, summary, calendarMonth })
        : activeView.id === "mailbox"
          ? renderMailboxView({
              mailbox: state.mailbox
            })
          : activeView.id === "accounts"
            ? renderAccountsView({
                users: state.accounts.users,
                loading: state.accounts.loading,
                error: state.accounts.error,
                canManage: (currentUser?.role || "member") === "admin"
              })
            : activeView.id === "emails"
              ? renderEmailStudioView({
                  templates: state.templates,
                  drafts: state.drafts
                })
              : renderAtomicIntelligenceView(state.intelligence);

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
              ? `<p>Signed in as <strong>${escapeHtml(currentUser?.username || "shared")}</strong></p>
                 <button type="button" class="ghost-button" data-action="sign-out">Sign Out</button>`
              : ""
          }
        </div>
      </aside>
      <main class="workspace">
        <section class="workspace-topbar panel">
          <div class="workspace-topbar__copy">
            <span class="eyebrow">${escapeHtml(activeView.eyebrow)}</span>
            <h2>${escapeHtml(activeView.title)}</h2>
            <p>${escapeHtml(activeView.description)}</p>
          </div>
          <div class="workspace-tabs" role="tablist" aria-label="Workspace sections">
            ${workspaceViews
              .map(
                (view) => `
                  <button
                    type="button"
                    class="workspace-tab ${view.id === activeView.id ? "is-active" : ""}"
                    data-action="set-workspace-view"
                    data-id="${view.id}"
                    role="tab"
                    aria-selected="${view.id === activeView.id ? "true" : "false"}"
                  >
                    ${escapeHtml(view.label)}
                  </button>
                `
              )
              .join("")}
          </div>
        </section>
        <section class="workspace-pane">
          ${activeWorkspaceMarkup}
        </section>
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
      ${renderAssistantWidget()}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderAssistantWidget() {
  const assistant = state.assistant;
  const quickPrompts = [
    "How many uncontacted companies?",
    "Top ask right now",
    "Follow-ups due soon"
  ];

  return `
    <section class="assistant-widget ${assistant.open ? "is-open" : ""}">
      <button type="button" class="assistant-widget__toggle" data-action="toggle-assistant">
        ${assistant.open ? "Close Assistant" : "Ask Assistant"}
      </button>
      ${
        assistant.open
          ? `
            <div class="assistant-widget__panel panel">
              <div class="assistant-widget__head">
                <strong>Sponsor Assistant</strong>
              </div>
              <div class="assistant-widget__messages">
                ${assistant.messages
                  .map(
                    (message) => `
                      <article class="assistant-widget__message assistant-widget__message--${message.role}">
                        <p>${escapeHtml(message.text)}</p>
                      </article>
                    `
                  )
                  .join("")}
              </div>
              <div class="assistant-widget__prompts">
                ${quickPrompts
                  .map(
                    (prompt) => `
                      <button
                        type="button"
                        class="ghost-button ghost-button--compact"
                        data-action="assistant-prompt"
                        data-id="${escapeHtml(prompt)}"
                      >
                        ${escapeHtml(prompt)}
                      </button>
                    `
                  )
                  .join("")}
              </div>
              <form id="assistant-form" class="assistant-widget__form">
                <input
                  name="question"
                  placeholder="Ask about your companies..."
                  value="${escapeHtml(assistant.input || "")}"
                  ${assistant.loading ? "disabled" : ""}
                  required
                />
                <button type="submit" class="primary-button primary-button--compact" ${
                  assistant.loading ? "disabled" : ""
                }>
                  ${assistant.loading ? "Thinking..." : "Ask"}
                </button>
              </form>
            </div>
          `
          : ""
      }
    </section>
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
      loginError: state.loginError,
      mode: state.auth.mode,
      setupUsername: state.auth.setupUsername,
      supabaseConnection: state.supabaseConnection
    });
    return;
  }

  if (state.editor?.open) {
    const preview = buildEditorPreview(state.editor);
    root.innerHTML = renderTemplateEditorView({
      editor: state.editor,
      company: getEditorCompany(state.editor),
      preview,
      mailboxConnected: state.mailbox.connected
    });
    if (shouldRestoreEditorFocus) {
      scheduleEditorFocusRestore();
    }
    return;
  }

  root.innerHTML = renderShell();
}

function renderAppPreserveModalScroll() {
  const modalCard = root.querySelector(".modal-card");
  const scrollTop = modalCard?.scrollTop || 0;
  const scrollLeft = modalCard?.scrollLeft || 0;
  renderApp();
  window.requestAnimationFrame(() => {
    const nextModalCard = root.querySelector(".modal-card");
    if (nextModalCard) {
      nextModalCard.scrollTop = scrollTop;
      nextModalCard.scrollLeft = scrollLeft;
    }
  });
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
    const intelligenceHistory = atomicIntelligenceService.loadHistory();
    state.intelligence.messages = intelligenceHistory.length
      ? intelligenceHistory
      : [
          {
            role: "assistant",
            text:
              "I’m Atomic Intelligence. Ask me for sponsor leads, company summaries, latest news, or outreach strategy."
          }
        ];

    if (!state.companies.some((company) => company.id === state.preferredCompanyId)) {
      state.preferredCompanyId = state.companies[0]?.id || "";
    }

    syncEditorCompanyOptions();
    consumeOauthFeedback();
    await loadMailboxStatus();
    await loadAccounts(false);
    state.loading = false;
    state.loginError = "";
    state.auth.mode = "login";
    state.auth.setupUsername = "";
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
    await authService.signOut();
    state.loading = false;
    renderApp();
    await refreshSupabaseConnectionStatus();
    return;
  }

  await loadAppData();
}

async function refreshSupabaseConnectionStatus() {
  state.supabaseConnection = {
    checking: true,
    status: "pending",
    message: "Checking Supabase connection..."
  };
  renderApp();

  if (!isSupabaseConfigured()) {
    state.supabaseConnection = {
      checking: false,
      status: "missing",
      message: "Supabase is not configured. The app will use demo mode until keys are set."
    };
    renderApp();
    return;
  }

  try {
    await supabaseService.testConnection();
    state.supabaseConnection = {
      checking: false,
      status: "ok",
      message: "Supabase API is reachable with the configured keys."
    };
  } catch (error) {
    state.supabaseConnection = {
      checking: false,
      status: "error",
      message: error.message || "Unable to reach Supabase with the configured keys."
    };
  }

  renderApp();
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

async function loadAccounts(showSpinner = true) {
  if (!isSupabaseConfigured()) {
    state.accounts.users = await accountService.listUsers();
    state.accounts.error = "";
    return;
  }

  if (showSpinner) {
    state.accounts.loading = true;
    state.accounts.error = "";
    renderApp();
  }

  try {
    state.accounts.users = await accountService.listUsers();
    state.accounts.error = "";
  } catch (error) {
    state.accounts.error = error.message || "Could not load user accounts.";
  } finally {
    state.accounts.loading = false;
    if (showSpinner) {
      renderApp();
    }
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
  state.modal.finderCompanyName = existingCompany.companyName || "";
  state.modal.finderWebsite = existingCompany.website || "";
  state.modal.selectedModalContactId = existingCompany.contacts?.[0]?.id || "";
  state.modal.contactDraftEmail = "";
  renderApp();
}

function closeEditor() {
  endLayoutDrag();
  state.editor = null;
  renderApp();
}

function focusEmailStudioForCompany(companyId) {
  state.preferredCompanyId = companyId;
  setWorkspaceView("emails");
  renderApp();
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

async function sendEditorEmailToSelectedContacts() {
  if (!state.editor) {
    return;
  }

  const company = getEditorCompany(state.editor);
  const companyContacts = getCompanyContacts(company);
  const selectedContacts = companyContacts.filter((contact) =>
    (state.editor.selectedContactIds || []).includes(contact.id)
  );
  const recipientContacts = selectedContacts.filter((contact) => String(contact.email || "").trim());

  if (!recipientContacts.length) {
    showToast("Select at least one contact with an email address.");
    return;
  }

  if (!state.mailbox.connected) {
    showToast("Connect Gmail first in the Mailbox section.");
    return;
  }

  let sentCount = 0;
  for (const contact of recipientContacts) {
    const preview = templateService.previewTemplate(
      {
        subject: state.editor.subjectInput,
        design: state.editor.design
      },
      createCompany({
        ...company,
        contactName: contact.name || company.contactName || "",
        contactRole: contact.role || company.contactRole || "",
        contactEmail: contact.email || company.contactEmail || ""
      })
    );

    await gmailService.sendMessage({
      to: String(contact.email || "").trim(),
      subject: preview.subject,
      htmlBody: preview.html
    });
    sentCount += 1;
  }

  await loadMailboxMessages(false);
  showToast(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"} from editor.`);
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
    selectedBlockId: draft.selectedBlockId || "body",
    selectedContactIds: draft.selectedContactIds || []
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
  const mode = String(formData.get("mode") || "login");
  const username = String(formData.get("username") || state.auth.setupUsername || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  state.loading = true;
  state.loginError = "";
  renderApp();

  try {
    if (mode === "setup") {
      if (!newPassword || newPassword.length < 8) {
        throw new Error("Use at least 8 characters for the new password.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Password confirmation does not match.");
      }

      await authService.completeFirstLogin(username, newPassword);
      await authService.signIn(
        {
          username,
          password: newPassword
        },
        APP_CONFIG.sitePassword
      );
    } else {
      const result = await authService.signIn(
        {
          username,
          password
        },
        APP_CONFIG.sitePassword
      );

      if (result.status === "setup_required") {
        state.loading = false;
        state.auth.mode = "setup";
        state.auth.setupUsername = username;
        state.loginError = `Welcome ${username}. Set your password to finish first login.`;
        renderApp();
        return;
      }
    }

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
  payload.contacts = Array.isArray(state.modal.draft.contacts) ? state.modal.draft.contacts : [];
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

async function runCompanyResearch() {
  const companyName = String(state.modal.finderCompanyName || state.modal.draft.companyName || "").trim();
  const website = String(state.modal.finderWebsite || "").trim();
  const context = String(state.modal.finderContext || "").trim();

  if (state.modal.researchMode === "website" && !website) {
    showToast("Add the company website in the finder first.");
    return;
  }

  if (state.modal.researchMode === "company" && !companyName) {
    showToast("Add the company name in the finder first.");
    return;
  }

  state.modal.researchLoading = true;
  state.modal.researchError = "";
  renderApp();

  try {
    const result = await companyResearchService.researchCompany({
      companyName,
      website,
      context,
      searchMode: state.modal.researchMode,
      companySearchMode: state.modal.companySearchMode
    });
    state.modal.researchLoading = false;
    state.modal.researchResult = buildResearchResultViewModel(result);
    state.modal.selectedCompanyCandidateId = result.companyCandidates?.[0]?.id || "";
    state.modal.appliedCompanyCandidateId = "";
    if (!state.modal.draft.website && state.modal.researchResult?.website) {
      state.modal.draft = createCompany({
        ...state.modal.draft,
        website: state.modal.researchResult.website
      });
    }
    if (!state.modal.draft.companyName && state.modal.researchResult?.companyName && !result.companyCandidates?.length) {
      state.modal.draft = createCompany({
        ...state.modal.draft,
        companyName: state.modal.researchResult.companyName
      });
    }
    renderApp();
    showToast(result.companyCandidates?.length ? "Potential companies found." : "Website research complete.");
  } catch (error) {
    console.error(error);
    state.modal.researchLoading = false;
    state.modal.researchError = error.message || "Could not run the company finder.";
    renderApp();
    showToast(error.message || "Could not run the company finder.");
  }
}

async function runExternalSponsorSearch() {
  const industry = String(state.modal.finderCompanyName || state.modal.draft.sector || "").trim();
  const context = String(state.modal.finderContext || "").trim();
  const website = String(state.modal.finderWebsite || state.modal.draft.website || "").trim();
  const companyName = String(state.modal.draft.companyName || state.modal.finderCompanyName || "").trim();

  if (!industry && !website && !companyName) {
    showToast("Add an industry, company name, or website first for external sponsor search.");
    return;
  }

  state.modal.researchLoading = true;
  state.modal.researchError = "";
  renderApp();

  try {
    const result = await companyResearchService.externalSponsorSearch({
      industry,
      context,
      website,
      companyName
    });
    state.modal.researchLoading = false;
    state.modal.researchMode = "company";
    state.modal.companySearchMode = "industry";
    state.modal.researchResult = buildResearchResultViewModel(result);
    state.modal.selectedCompanyCandidateId = result.companyCandidates?.[0]?.id || "";
    state.modal.appliedCompanyCandidateId = "";
    renderApp();
    showToast("External sponsor search complete.");
  } catch (error) {
    console.error(error);
    state.modal.researchLoading = false;
    state.modal.researchError = error.message || "External sponsor search failed.";
    renderApp();
    showToast(error.message || "External sponsor search failed.");
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
    selectedContactIds: Array.isArray(state.editor.selectedContactIds) ? state.editor.selectedContactIds : [],
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
    case "set-workspace-view":
      setWorkspaceView(id);
      if (id === "accounts") {
        await loadAccounts(false);
      }
      renderApp();
      return;
    case "set-intelligence-tab":
      state.intelligence.activeTab = id || "chat";
      renderApp();
      return;
    case "intelligence-clear-chat":
      state.intelligence.messages = [
        {
          role: "assistant",
          text:
            "History cleared. Ask for company summaries, sponsor targets, funding opportunities, or outreach strategy."
        }
      ];
      state.intelligence.error = "";
      atomicIntelligenceService.clearHistory();
      atomicIntelligenceService.saveHistory(state.intelligence.messages);
      renderApp();
      return;
    case "toggle-assistant":
      state.assistant.open = !state.assistant.open;
      renderApp();
      return;
    case "assistant-prompt":
      await handleAssistantQuestion(id || "");
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
      if (state.modal.researchLoading) {
        return;
      }

      await runCompanyResearch();
      return;
    }
    case "research-external": {
      if (state.modal.researchLoading) {
        return;
      }

      await runExternalSponsorSearch();
      return;
    }
    case "set-research-mode":
      state.modal.researchMode = id === "company" ? "company" : "website";
      state.modal.researchError = "";
      state.modal.researchResult = null;
      state.modal.selectedCompanyCandidateId = "";
      renderApp();
      return;
    case "set-company-search-mode":
      state.modal.companySearchMode = id === "industry" ? "industry" : "company";
      state.modal.researchError = "";
      state.modal.researchResult = null;
      state.modal.selectedCompanyCandidateId = "";
      state.modal.appliedCompanyCandidateId = "";
      renderApp();
      return;
    case "preview-company-candidate": {
      const candidate = state.modal.researchResult?.companyCandidates?.find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      previewResearchCompanyCandidate(candidate);
      renderApp();
      return;
    }
    case "select-company-candidate": {
      const candidate = state.modal.researchResult?.companyCandidates?.find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      applyResearchCompanyCandidate(candidate);
      renderAppPreserveModalScroll();
      showToast("Company details applied to the main form.");
      return;
    }
    case "apply-research-suggestions":
      if (!state.modal.researchResult) {
        return;
      }

      applyResearchSuggestionsToDraft(state.modal.researchResult);
      renderAppPreserveModalScroll();
      showToast("Research suggestions applied.");
      return;
    case "select-research-candidate": {
      const candidate = buildResearchCandidates(state.modal.researchResult).find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      applyResearchCandidate(candidate);
      renderAppPreserveModalScroll();
      showToast("Contact added to this company.");
      return;
    }
    case "reopen-completed-research": {
      const candidate = state.modal.completedResearchEntries.find((entry) => entry.id === id);
      if (!candidate) {
        return;
      }

      applyResearchCandidate(candidate);
      renderAppPreserveModalScroll();
      showToast("Completed result reopened.");
      return;
    }
    case "apply-research-contact": {
      const contact = state.modal.researchResult?.contacts?.[Number(id)] || null;
      if (!contact) {
        return;
      }

      const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
      const normalizedName = String(contact.name || "").trim().toLowerCase();
      const existingIndex = contacts.findIndex(
        (entry) => String(entry.name || "").trim().toLowerCase() === normalizedName
      );
      const nextContact = {
        id: contacts[existingIndex]?.id || crypto.randomUUID(),
        name: contact.name || "",
        role: contact.role || "",
        email: contacts[existingIndex]?.email || "",
        source: contact.source || "",
        matchReason: contact.matchReason || ""
      };
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...nextContact };
      } else {
        contacts.push(nextContact);
      }

      state.modal.draft = createCompany({
        ...state.modal.draft,
        contacts
      });
      renderAppPreserveModalScroll();
      showToast("Contact added.");
      return;
    }
    case "apply-research-email": {
      const email = state.modal.researchResult?.emails?.[Number(id)] || null;
      if (!email) {
        return;
      }

      const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
      const normalizedEmail = String(email.email || "").trim().toLowerCase();
      const existingIndex = contacts.findIndex(
        (entry) => String(entry.email || "").trim().toLowerCase() === normalizedEmail
      );
      const nextContact = {
        id: contacts[existingIndex]?.id || crypto.randomUUID(),
        name: contacts[existingIndex]?.name || email.contactName || "",
        role: contacts[existingIndex]?.role || email.contactRole || "",
        email: email.email || "",
        source: email.source || "",
        matchReason: email.matchReason || ""
      };
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...nextContact };
      } else {
        contacts.push(nextContact);
      }

      state.modal.draft = createCompany({
        ...state.modal.draft,
        contacts
      });
      renderAppPreserveModalScroll();
      showToast("Email contact added.");
      return;
    }
    case "set-primary-contact": {
      setPrimaryContactById(id);
      renderAppPreserveModalScroll();
      showToast("Primary contact updated.");
      return;
    }
    case "select-modal-contact": {
      state.modal.selectedModalContactId = id;
      renderAppPreserveModalScroll();
      return;
    }
    case "add-contact-email": {
      const result = addContactEmailToDraft(state.modal.contactDraftEmail);
      if (result.ok) {
        renderAppPreserveModalScroll();
        showToast("Contact email added.");
        return;
      }
      if (result.reason === "invalid") {
        showToast("Add a valid email address.");
        return;
      }
      if (result.reason === "exists") {
        renderAppPreserveModalScroll();
        showToast("That email is already in contacts.");
        return;
      }
      showToast("Enter an email first.");
      return;
    }
    case "remove-contact": {
      removeContactById(id);
      renderAppPreserveModalScroll();
      showToast("Contact removed.");
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
    case "send-editor-to-selected-contacts":
      await sendEditorEmailToSelectedContacts();
      return;
    case "run-editor-ai-assist":
      await runEditorAiAssist();
      return;
    case "apply-editor-ai-full-draft":
      applyEditorAiFullDraft();
      return;
    case "apply-editor-ai-continuation":
      applyEditorAiContinuation();
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
      state.accounts.users = [];
      state.accounts.error = "";
      state.loginError = "";
      state.auth.mode = "login";
      state.auth.setupUsername = "";
      state.preferredCompanyId = "";
      state.editor = null;
      renderApp();
      return;
    case "reset-user-password": {
      const currentUser = authService.getUser();
      if ((currentUser?.role || "member") !== "admin") {
        showToast("Only admins can reset teammate passwords.");
        return;
      }

      if (!window.confirm(`Force a password reset for ${id}?`)) {
        return;
      }

      try {
        await accountService.resetPassword(id);
        await loadAccounts(false);
        renderApp();
        showToast("Password reset flag updated.");
      } catch (error) {
        showToast(error.message || "Could not reset that password.");
      }
      return;
    }
    default:
      return;
  }
});

root.addEventListener("input", (event) => {
  if (event.target.id === "intelligence-chat-input") {
    state.intelligence.input = event.target.value;
    return;
  }

  if (event.target.id === "company-search") {
    state.filters.search = event.target.value;
    companySearchFocusSnapshot = {
      selectionStart: event.target.selectionStart,
      selectionEnd: event.target.selectionEnd,
      selectionDirection: event.target.selectionDirection
    };
    renderApp();
    scheduleCompanySearchFocusRestore();
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
      if (name === "contactDraftEmail") {
        state.modal.contactDraftEmail = value;
        return;
      }

      if (name === "selectedContactName") {
        updateSelectedModalContactField("name", value);
        return;
      }

      if (name === "selectedContactRole") {
        updateSelectedModalContactField("role", value);
        return;
      }

      if (name === "selectedContactContext") {
        updateSelectedModalContactField("matchReason", value);
        return;
      }

      if (name === "contactName" || name === "contactRole" || name === "contactEmail") {
        const contacts = Array.isArray(state.modal.draft.contacts) ? [...state.modal.draft.contacts] : [];
        const primary = {
          id: contacts[0]?.id || crypto.randomUUID(),
          name: name === "contactName" ? value : contacts[0]?.name || state.modal.draft.contactName || "",
          role: name === "contactRole" ? value : contacts[0]?.role || state.modal.draft.contactRole || "",
          email: name === "contactEmail" ? value : contacts[0]?.email || state.modal.draft.contactEmail || "",
          source: contacts[0]?.source || "",
          matchReason: contacts[0]?.matchReason || ""
        };
        contacts[0] = primary;
        state.modal.draft = {
          ...state.modal.draft,
          contacts,
          [name]: value
        };
        return;
      }

      state.modal.draft = {
        ...state.modal.draft,
        [name]: type === "number" ? Number(value || 0) : value
      };
    }
    return;
  }

  if (event.target.dataset.finderField) {
    state.modal[event.target.dataset.finderField] = event.target.value;
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

  if (event.target.id === "editor-ai-assist-prompt") {
    state.editor.aiAssistPrompt = event.target.value;
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

  if (event.target.id === "response-status-filter") {
    state.filters.responseStatus = event.target.value;
    renderApp();
    return;
  }

  if (event.target.id === "ask-type-filter") {
    state.filters.askType = event.target.value;
    renderApp();
    return;
  }

  if (event.target.id === "company-sort-filter") {
    state.filters.sortBy = event.target.value;
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
    const selectedCompany = getEditorCompany(state.editor);
    const selectedCompanyContacts = getCompanyContacts(selectedCompany);
    state.editor.selectedContactIds = selectedCompanyContacts[0]?.id ? [selectedCompanyContacts[0].id] : [];
    renderApp();
    return;
  }

  if (event.target.id === "editor-ai-assist-mode") {
    state.editor.aiAssistMode = event.target.value || "first_outreach";
    state.editor.aiAssistError = "";
    renderApp();
    return;
  }

  if (event.target.name === "editor-contact-target") {
    const contactId = String(event.target.value || "");
    const selected = new Set(state.editor.selectedContactIds || []);
    if (event.target.checked) {
      selected.add(contactId);
    } else {
      selected.delete(contactId);
    }
    state.editor.selectedContactIds = [...selected];
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

  if (event.target.id === "assistant-form") {
    const formData = new FormData(event.target);
    await handleAssistantQuestion(String(formData.get("question") || ""));
    event.target.reset();
    return;
  }

  if (event.target.id === "intelligence-chat-form") {
    const formData = new FormData(event.target);
    await handleIntelligenceQuestion(String(formData.get("question") || ""));
    return;
  }

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

  if (event.target.id === "add-account-form") {
    const currentUser = authService.getUser();
    if ((currentUser?.role || "member") !== "admin") {
      showToast("Only admins can add teammate usernames.");
      return;
    }

    const formData = new FormData(event.target);
    const username = String(formData.get("username") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "member").trim().toLowerCase();

    try {
      await accountService.createUser(username, role === "admin" ? "admin" : "member");
      event.target.reset();
      await loadAccounts(false);
      renderApp();
      showToast(`${username} added. They can set their password on first login.`);
    } catch (error) {
      state.accounts.error = error.message || "Could not add that username.";
      renderApp();
      showToast(state.accounts.error);
    }
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
