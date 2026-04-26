export const companyStatusOptions = [
  { value: "prospect", label: "Prospect" },
  { value: "warm", label: "Warm Lead" },
  { value: "proposal", label: "Proposal Sent" },
  { value: "negotiating", label: "Negotiating" },
  { value: "secured", label: "Secured" },
  { value: "closed", label: "Closed" }
];

export const askTypeOptions = [
  { value: "cash", label: "Cash Sponsorship" },
  { value: "materials", label: "Materials" },
  { value: "machining", label: "Machining" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "software", label: "Software / Data" },
  { value: "media", label: "Media / Content" },
  { value: "travel", label: "Travel / Logistics" },
  { value: "hybrid", label: "Hybrid Support" }
];

export const responseStatusOptions = [
  { value: "waiting", label: "Waiting" },
  { value: "interested", label: "Interested" },
  { value: "requested_info", label: "Requested More Info" },
  { value: "interview", label: "Interview Scheduled" },
  { value: "won", label: "Confirmed Support" },
  { value: "declined", label: "Declined" }
];

const baseCompany = {
  id: "",
  companyName: "",
  website: "",
  contacts: [],
  contactName: "",
  contactRole: "",
  contactEmail: "",
  sector: "",
  status: "prospect",
  askType: "cash",
  askValue: 0,
  contributionValue: 0,
  contributionType: "",
  firstContacted: "",
  nextFollowUp: "",
  proposalDate: "",
  interviewDate: "",
  responseStatus: "waiting",
  requestFromUs: "",
  givingInReturn: "",
  researchSummary: "",
  personalizationNotes: "",
  notes: "",
  createdAt: "",
  lastUpdated: ""
};

function deriveFollowUpDate(firstContacted, explicitFollowUp) {
  const normalizedFollowUp = normalizeDate(explicitFollowUp);
  if (normalizedFollowUp) {
    return normalizedFollowUp;
  }

  const normalizedFirstContacted = normalizeDate(firstContacted);
  if (!normalizedFirstContacted) {
    return "";
  }

  const followUp = new Date(normalizedFirstContacted);
  if (Number.isNaN(followUp.getTime())) {
    return "";
  }

  followUp.setDate(followUp.getDate() + 7);
  return followUp.toISOString().slice(0, 10);
}

function parseMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function normalizeContact(input = {}) {
  const name = String(input.name ?? input.contactName ?? "").trim();
  const role = String(input.role ?? input.contactRole ?? "").trim();
  const email = String(input.email ?? input.contactEmail ?? "").trim();

  if (!name && !role && !email) {
    return null;
  }

  return {
    id: String(input.id || crypto.randomUUID()),
    name,
    role,
    email,
    source: String(input.source || "").trim(),
    matchReason: String(input.matchReason || "").trim()
  };
}

function normalizeContacts(inputContacts = []) {
  const seen = new Set();
  const normalized = [];

  const list = Array.isArray(inputContacts) ? inputContacts : [];
  for (const entry of list) {
    const contact = normalizeContact(entry);
    if (!contact) {
      continue;
    }

    const dedupeKey = `${contact.email.toLowerCase()}|${contact.name.toLowerCase()}|${contact.role.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(contact);
  }

  return normalized;
}

export function createCompany(input = {}) {
  const now = new Date().toISOString();
  const firstContacted = normalizeDate(input.firstContacted ?? input.first_contacted);
  const nextFollowUp = deriveFollowUpDate(
    firstContacted,
    input.nextFollowUp ?? input.next_follow_up
  );
  const explicitContactName = String(input.contactName ?? input.contact_name ?? "").trim();
  const explicitContactRole = String(input.contactRole ?? input.contact_role ?? "").trim();
  const explicitContactEmail = String(input.contactEmail ?? input.contact_email ?? "").trim();

  let inputContacts = input.contacts ?? input.contact_list ?? [];
  if (typeof inputContacts === "string") {
    try {
      inputContacts = JSON.parse(inputContacts);
    } catch {
      inputContacts = [];
    }
  }

  let contacts = normalizeContacts(inputContacts);
  const legacyContact = normalizeContact({
    name: explicitContactName,
    role: explicitContactRole,
    email: explicitContactEmail
  });
  if (legacyContact) {
    const existingIndex = contacts.findIndex(
      (entry) =>
        legacyContact.email &&
        entry.email &&
        entry.email.toLowerCase() === legacyContact.email.toLowerCase()
    );
    if (existingIndex >= 0) {
      contacts[existingIndex] = {
        ...contacts[existingIndex],
        name: legacyContact.name || contacts[existingIndex].name,
        role: legacyContact.role || contacts[existingIndex].role
      };
      const [primary] = contacts.splice(existingIndex, 1);
      contacts.unshift(primary);
    } else {
      contacts.unshift(legacyContact);
    }
  }

  const primaryContact = contacts[0] || null;

  return {
    ...baseCompany,
    id: input.id || crypto.randomUUID(),
    companyName: input.companyName ?? input.company_name ?? "",
    website: input.website ?? input.company_website ?? "",
    contacts,
    contactName: explicitContactName || primaryContact?.name || "",
    contactRole: explicitContactRole || primaryContact?.role || "",
    contactEmail: explicitContactEmail || primaryContact?.email || "",
    sector: input.sector ?? "",
    status: input.status ?? "prospect",
    askType: input.askType ?? input.ask_type ?? "cash",
    askValue: parseMoney(input.askValue ?? input.ask_value),
    contributionValue: parseMoney(
      input.contributionValue ?? input.contribution_value
    ),
    contributionType: input.contributionType ?? input.contribution_type ?? "",
    firstContacted,
    nextFollowUp,
    proposalDate: normalizeDate(input.proposalDate ?? input.proposal_date),
    interviewDate: normalizeDate(input.interviewDate ?? input.interview_date),
    responseStatus: input.responseStatus ?? input.response_status ?? "waiting",
    requestFromUs: input.requestFromUs ?? input.request_from_us ?? "",
    givingInReturn: input.givingInReturn ?? input.giving_in_return ?? "",
    researchSummary: input.researchSummary ?? input.research_summary ?? "",
    personalizationNotes: input.personalizationNotes ?? input.personalization_notes ?? "",
    notes: input.notes ?? "",
    createdAt: input.createdAt ?? input.created_at ?? now,
    lastUpdated: input.lastUpdated ?? input.updated_at ?? now
  };
}

export function serializeCompanyForApi(company) {
  const normalized = createCompany(company);

  return {
    id: normalized.id,
    company_name: normalized.companyName,
    company_website: normalized.website,
    contact_name: normalized.contactName,
    contact_role: normalized.contactRole,
    contact_email: normalized.contactEmail,
    contacts: normalized.contacts,
    sector: normalized.sector,
    status: normalized.status,
    ask_type: normalized.askType,
    ask_value: normalized.askValue,
    contribution_value: normalized.contributionValue,
    contribution_type: normalized.contributionType,
    first_contacted: normalized.firstContacted || null,
    next_follow_up: normalized.nextFollowUp || null,
    proposal_date: normalized.proposalDate || null,
    interview_date: normalized.interviewDate || null,
    response_status: normalized.responseStatus,
    request_from_us: normalized.requestFromUs,
    giving_in_return: normalized.givingInReturn,
    research_summary: normalized.researchSummary,
    personalization_notes: normalized.personalizationNotes,
    notes: normalized.notes
  };
}

export function deserializeCompanyFromApi(record) {
  return createCompany(record);
}

export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}
