import { daysUntil, sortByDate } from "../utils/date-utils.js";

const milestoneDefinitions = [
  {
    key: "nextFollowUp",
    type: "Follow Up",
    tone: "warning",
    description: (company) =>
      `Follow up with ${company.contactName || company.companyName} about next steps.`
  },
  {
    key: "proposalDate",
    type: "Proposal",
    tone: "accent",
    description: (company) => `Proposal milestone for ${company.companyName}.`
  },
  {
    key: "interviewDate",
    type: "Interview",
    tone: "success",
    description: (company) =>
      `Interview or review meeting scheduled with ${company.companyName}.`
  }
];

export function buildCalendarEvents(companies) {
  const events = companies.flatMap((company) =>
    milestoneDefinitions
      .filter((definition) => company[definition.key])
      .map((definition) => ({
        id: `${company.id}-${definition.key}`,
        companyId: company.id,
        companyName: company.companyName,
        contactName: company.contactName,
        type: definition.type,
        tone: definition.tone,
        date: company[definition.key],
        description: definition.description(company),
        daysAway: daysUntil(company[definition.key])
      }))
  );

  return sortByDate(events, "date");
}

export function buildCalendarSummary(events) {
  return {
    overdue: events.filter((event) => event.daysAway !== null && event.daysAway < 0).length,
    nextSevenDays: events.filter(
      (event) => event.daysAway !== null && event.daysAway >= 0 && event.daysAway <= 7
    ).length,
    proposals: events.filter((event) => event.type === "Proposal").length,
    interviews: events.filter((event) => event.type === "Interview").length
  };
}
