import { companyStatusOptions } from "../models/company-model.js";

const palette = ["#ff5b3d", "#ff9f43", "#ffd166", "#39d98a", "#56ccf2", "#7d7aff"];

export function buildDashboardSnapshot(companies, fundraisingTarget) {
  const totalRaised = companies.reduce(
    (sum, company) => sum + Number(company.contributionValue || 0),
    0
  );
  const totalAsked = companies.reduce(
    (sum, company) => sum + Number(company.askValue || 0),
    0
  );
  const remainingToTarget = Math.max(fundraisingTarget - totalRaised, 0);
  const progress = fundraisingTarget ? totalRaised / fundraisingTarget : 0;
  const warmPipelineCount = companies.filter((company) =>
    ["warm", "proposal", "negotiating"].includes(company.status)
  ).length;
  const securedCount = companies.filter((company) => company.status === "secured").length;
  const overdueFollowUps = companies.filter((company) => {
    if (!company.nextFollowUp) {
      return false;
    }

    const target = new Date(company.nextFollowUp);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return target < today;
  }).length;

  const contributionSegments = companies
    .filter((company) => Number(company.contributionValue) > 0)
    .sort((left, right) => right.contributionValue - left.contributionValue)
    .map((company, index) => ({
      label: company.companyName,
      value: company.contributionValue,
      color: palette[index % palette.length]
    }));

  if (remainingToTarget > 0) {
    contributionSegments.push({
      label: "Still to raise",
      value: remainingToTarget,
      color: "rgba(255,255,255,0.14)"
    });
  }

  const statusBreakdown = companyStatusOptions.map((status) => ({
    label: status.label,
    value: companies.filter((company) => company.status === status.value).length
  }));

  return {
    totalRaised,
    totalAsked,
    remainingToTarget,
    progress,
    warmPipelineCount,
    securedCount,
    overdueFollowUps,
    contributionSegments,
    statusBreakdown,
    topBackers: companies
      .filter((company) => Number(company.contributionValue) > 0)
      .sort((left, right) => right.contributionValue - left.contributionValue)
      .slice(0, 4)
  };
}
