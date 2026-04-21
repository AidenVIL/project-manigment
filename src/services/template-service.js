import { APP_CONFIG } from "../config/runtime-config.js";
import {
  createTemplate,
  deserializeTemplateFromApi,
  serializeTemplateForApi
} from "../models/template-model.js";
import { seedTemplates } from "../data/mock-data.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { STORAGE_KEYS, storageService } from "./storage-service.js";
import { supabaseService } from "./supabase-service.js";

export const availableTokens = [
  "{{team_name}}",
  "{{season_label}}",
  "{{team_signature}}",
  "{{team_website}}",
  "{{company_name}}",
  "{{contact_first_name}}",
  "{{contact_full_name}}",
  "{{contact_email}}",
  "{{ask_type}}",
  "{{ask_value}}",
  "{{contribution_value}}",
  "{{contribution_type}}",
  "{{next_follow_up}}",
  "{{proposal_date}}",
  "{{request_from_us}}",
  "{{giving_in_return}}"
];

function sortTemplates(templates) {
  return [...templates].sort((left, right) => left.name.localeCompare(right.name));
}

function readStoredTemplates() {
  return storageService
    .read(STORAGE_KEYS.templates, [])
    .map((template) => createTemplate(template));
}

function getTokenMap(company = {}) {
  const firstName = String(company.contactName || "").split(/\s+/).filter(Boolean)[0] || "there";

  return {
    team_name: APP_CONFIG.teamName,
    season_label: APP_CONFIG.seasonLabel,
    team_signature: APP_CONFIG.teamSignature,
    team_website: APP_CONFIG.teamWebsite,
    company_name: company.companyName || "your organisation",
    contact_first_name: firstName,
    contact_full_name: company.contactName || "team",
    contact_email: company.contactEmail || "contact@company.com",
    ask_type: company.askType || "support",
    ask_value: formatCurrency(company.askValue || 0),
    contribution_value: formatCurrency(company.contributionValue || 0),
    contribution_type: company.contributionType || "support package",
    next_follow_up: formatDate(company.nextFollowUp),
    proposal_date: formatDate(company.proposalDate),
    request_from_us: company.requestFromUs || "shared activation planning",
    giving_in_return: company.givingInReturn || "partnership support"
  };
}

function applyTokens(source, company) {
  const tokens = getTokenMap(company);

  return String(source || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, token) => {
    return tokens[token] ?? `{{${token}}}`;
  });
}

export const templateService = {
  async loadTemplates() {
    if (supabaseService.isReady()) {
      const records = await supabaseService.list("email_templates");
      const templates = sortTemplates(records.map(deserializeTemplateFromApi));
      storageService.write(STORAGE_KEYS.templates, templates);
      return templates;
    }

    const storedTemplates = readStoredTemplates();
    if (storedTemplates.length) {
      return sortTemplates(storedTemplates);
    }

    const templates = sortTemplates(seedTemplates.map((template) => createTemplate(template)));
    storageService.write(STORAGE_KEYS.templates, templates);
    return templates;
  },
  async saveTemplate(input) {
    const template = createTemplate({
      ...input,
      updatedAt: new Date().toISOString()
    });
    const currentTemplates = readStoredTemplates();
    const exists = currentTemplates.some((item) => item.id === template.id);
    const nextTemplates = sortTemplates(
      exists
        ? currentTemplates.map((item) => (item.id === template.id ? template : item))
        : [...currentTemplates, template]
    );

    storageService.write(STORAGE_KEYS.templates, nextTemplates);

    if (supabaseService.isReady()) {
      await supabaseService.upsert("email_templates", serializeTemplateForApi(template));
    }

    return template;
  },
  previewTemplate(template, company) {
    const normalized = createTemplate(template);
    return {
      subject: applyTokens(normalized.subject, company),
      html: applyTokens(normalized.html, company),
      tokens: getTokenMap(company)
    };
  },
  createStarterTemplate(index) {
    return createTemplate({
      name: `Custom Template ${index}`,
      category: "Custom",
      subject: "{{team_name}} update for {{company_name}}",
      html: `<div style="font-family: Arial, sans-serif; background:#ffffff; color:#182230; max-width:640px; margin:0 auto; padding:32px; border:1px solid #e8edf5; border-radius:20px;">
  <p style="font-size:16px; line-height:1.7;">Hi {{contact_first_name}},</p>
  <p style="font-size:16px; line-height:1.7;">I wanted to share a quick update from {{team_name}} and keep our conversation moving.</p>
  <p style="font-size:16px; line-height:1.7;">We are currently progressing a package around {{ask_type}} and would love to shape it around what matters most to {{company_name}}.</p>
  <p style="font-size:16px; line-height:1.7;">Best,<br /><strong>{{team_signature}}</strong></p>
</div>`
    });
  }
};
