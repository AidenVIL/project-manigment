import { formatCurrency, formatDate, formatRelativeCountdown } from "../utils/formatters.js";
import { daysUntil } from "../utils/date-utils.js";

function normalize(text = "") {
  return String(text || "").trim().toLowerCase();
}

function findCompanyByName(companies = [], question = "") {
  const q = normalize(question);
  if (!q) {
    return null;
  }

  return (
    companies.find((company) => {
      const name = normalize(company.companyName);
      return name && q.includes(name);
    }) || null
  );
}

function buildCompanyMiniSummary(company) {
  const shortResearch = String(company.researchSummary || "").trim();
  const shortAngle = String(company.personalizationNotes || "").trim();
  const followUpDays = daysUntil(company.nextFollowUp);
  const followUpLabel = formatRelativeCountdown(followUpDays);
  return [
    `${company.companyName}: status ${company.status || "prospect"}, response ${company.responseStatus || "waiting"}.`,
    `Ask ${formatCurrency(company.askValue || 0)}, confirmed ${formatCurrency(company.contributionValue || 0)}.`,
    `Next follow-up ${formatDate(company.nextFollowUp)} (${followUpLabel}).`,
    shortResearch ? `Research: ${shortResearch.slice(0, 240)}${shortResearch.length > 240 ? "..." : ""}` : "",
    shortAngle ? `Email angle: ${shortAngle.slice(0, 180)}${shortAngle.length > 180 ? "..." : ""}` : ""
  ].join(" ");
}

function topAskCompany(companies = []) {
  if (!companies.length) {
    return null;
  }

  return [...companies].sort((a, b) => Number(b.askValue || 0) - Number(a.askValue || 0))[0] || null;
}

function topConfirmedCompany(companies = []) {
  if (!companies.length) {
    return null;
  }

  return [...companies].sort((a, b) => Number(b.contributionValue || 0) - Number(a.contributionValue || 0))[0] || null;
}

function companiesDueSoon(companies = [], days = 7) {
  return companies.filter((company) => {
    if (!company.nextFollowUp) {
      return false;
    }
    const countdown = daysUntil(company.nextFollowUp);
    return countdown <= days;
  });
}

export function askCompanyAssistant({ question = "", companies = [] } = {}) {
  const q = normalize(question);
  const total = companies.length;
  const noEmailSent = companies.filter((company) => !company.firstContacted).length;
  const confirmed = companies.filter(
    (company) => company.responseStatus === "won" || company.status === "secured"
  ).length;

  if (!q) {
    return {
      answer: "Ask me about your sponsor pipeline, follow-ups, top-value companies, or a specific company by name.",
      needsLookup: false
    };
  }

  const directCompany = findCompanyByName(companies, q);
  if (directCompany) {
    return {
      answer: buildCompanyMiniSummary(directCompany),
      needsLookup: false
    };
  }

  if (q.includes("how many") && (q.includes("company") || q.includes("sponsor"))) {
    return {
      answer: `You currently have ${total} companies tracked. ${noEmailSent} have no email sent yet, and ${confirmed} are confirmed.`,
      needsLookup: false
    };
  }

  if (q.includes("no email") || q.includes("not contacted") || q.includes("uncontacted")) {
    return {
      answer: `${noEmailSent} companies currently show no first-contact date (no outreach email sent yet).`,
      needsLookup: false
    };
  }

  if (q.includes("top ask") || q.includes("highest ask")) {
    const top = topAskCompany(companies);
    return {
      answer: top
        ? `Highest ask is ${top.companyName} at ${formatCurrency(top.askValue || 0)}.`
        : "I could not find a highest ask because there are no companies yet.",
      needsLookup: false
    };
  }

  if (q.includes("top confirmed") || q.includes("highest confirmed") || q.includes("most confirmed")) {
    const top = topConfirmedCompany(companies);
    return {
      answer: top
        ? `Highest confirmed contribution is ${top.companyName} at ${formatCurrency(top.contributionValue || 0)}.`
        : "No confirmed contributions found yet.",
      needsLookup: false
    };
  }

  if (q.includes("follow up") || q.includes("follow-up") || q.includes("due soon")) {
    const due = companiesDueSoon(companies, 7).slice(0, 5);
    if (!due.length) {
      return {
        answer: "No follow-ups are due in the next 7 days.",
        needsLookup: false
      };
    }

    const list = due
      .map((company) => `${company.companyName} (${formatDate(company.nextFollowUp)})`)
      .join(", ");
    return {
      answer: `Follow-ups due within 7 days: ${list}.`,
      needsLookup: false
    };
  }

  if (q.includes("help") || q.includes("what can you do")) {
    return {
      answer:
        "I can summarise a specific company, use saved research and personalisation notes for email writing, count outreach states, list follow-ups due soon, and highlight top ask or top confirmed companies.",
      needsLookup: false
    };
  }

  return {
    answer:
      "I couldn't match that exactly yet. Try asking: 'how many uncontacted', 'top ask', 'follow-ups due soon', or include a company name.",
    needsLookup: true
  };
}
