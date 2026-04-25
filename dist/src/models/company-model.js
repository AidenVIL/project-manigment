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

export function createCompany(input = {}) {
  const now = new Date().toISOString();
  const firstContacted = normalizeDate(input.firstContacted ?? input.first_contacted);
  const nextFollowUp = deriveFollowUpDate(
    firstContacted,
    input.nextFollowUp ?? input.next_follow_up
  );

  return {
    ...baseCompany,
    id: input.id || crypto.randomUUID(),
    companyName: input.companyName ?? input.company_name ?? "",
    website: input.website ?? input.company_website ?? "",
    contactName: input.contactName ?? input.contact_name ?? "",
    contactRole: input.contactRole ?? input.contact_role ?? "",
    contactEmail: input.contactEmail ?? input.contact_email ?? "",
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
