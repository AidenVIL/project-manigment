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

function toDateKey(value) {
  return String(value || "").slice(0, 10);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + mondayOffset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

export function buildCalendarMonthView(events, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const monthAnchor = new Date(today);
  monthAnchor.setDate(1);
  monthAnchor.setHours(0, 0, 0, 0);

  const monthStart = startOfWeek(monthAnchor);
  const monthEnd = endOfWeek(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0));
  const eventsByDate = events.reduce((accumulator, event) => {
    const key = toDateKey(event.date);
    accumulator[key] = [...(accumulator[key] || []), event];
    return accumulator;
  }, {});

  const weeks = [];
  const cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    const week = [];

    for (let index = 0; index < 7; index += 1) {
      const key = toDateKey(cursor.toISOString());
      week.push({
        key,
        dayNumber: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === monthAnchor.getMonth(),
        isToday: key === toDateKey(today.toISOString()),
        events: eventsByDate[key] || []
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
  }

  return {
    monthKey: toDateKey(monthAnchor.toISOString()),
    monthLabel: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric"
    }).format(monthAnchor),
    dayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weeks,
    agenda: events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getFullYear() === monthAnchor.getFullYear() &&
        eventDate.getMonth() === monthAnchor.getMonth()
      );
    })
  };
}
