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

export const templateBuilderActions = [
  { id: "heading", label: "Heading" },
  { id: "paragraph", label: "Paragraph" },
  { id: "bold", label: "Bold" },
  { id: "button", label: "Button" },
  { id: "divider", label: "Divider" },
  { id: "spacer", label: "Spacer" }
];

export const templateBlockLibrary = [
  {
    id: "intro",
    name: "Intro Block",
    description: "Opening copy with contact and sponsor fit.",
    html: `<p style="margin:0 0 18px; color:#1d2a20; font-size:16px; line-height:1.7;">Hi {{contact_first_name}},</p>
<p style="margin:0 0 18px; color:#405246; font-size:16px; line-height:1.7;">I am reaching out from {{team_name}} because we think {{company_name}} could be a strong fit for a partnership rooted in performance, visibility, and student engineering impact.</p>`
  },
  {
    id: "value-prop",
    name: "Value Block",
    description: "Structured ask and return section.",
    html: `<div style="margin:0 0 20px; padding:20px; border:1px solid #d4ead4; border-radius:18px; background:#f7fff7;">
  <h3 style="margin:0 0 10px; color:#102012; font-size:20px;">Proposed Partnership</h3>
  <p style="margin:0 0 10px; color:#405246; font-size:15px; line-height:1.7;"><strong>Support we are seeking:</strong> {{ask_type}} valued at {{ask_value}}</p>
  <p style="margin:0; color:#405246; font-size:15px; line-height:1.7;"><strong>What we can offer:</strong> {{request_from_us}}</p>
</div>`
  },
  {
    id: "cta",
    name: "CTA Block",
    description: "Call to action button and closing.",
    html: `<div style="margin:24px 0 20px;">
  <a href="{{team_website}}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#32ce32; color:#051005; font-weight:700; text-decoration:none;">View Team Website</a>
</div>
<p style="margin:0; color:#405246; font-size:15px; line-height:1.7;">If it helps, I would be happy to send across a short proposal and set up a quick call.</p>`
  },
  {
    id: "stats",
    name: "Stats Card",
    description: "Clean highlighted figures section.",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="width:50%; padding:8px;">
      <div style="padding:18px; border-radius:18px; background:#0f1f12; color:#f4fff4;">
        <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; opacity:0.7;">Ask Value</div>
        <div style="margin-top:8px; font-size:28px; font-weight:700;">{{ask_value}}</div>
      </div>
    </td>
    <td style="width:50%; padding:8px;">
      <div style="padding:18px; border-radius:18px; background:#f3fff1; color:#102012; border:1px solid #d4ead4;">
        <div style="font-size:12px; letter-spacing:0.16em; text-transform:uppercase; opacity:0.7;">Next Follow-Up</div>
        <div style="margin-top:8px; font-size:24px; font-weight:700;">{{next_follow_up}}</div>
      </div>
    </td>
  </tr>
</table>`
  }
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

export function getBuilderActionMarkup(actionId, selectedText = "") {
  const content = selectedText || "Write your content here";
  const snippets = {
    heading: `<h2 style="margin:0 0 14px; color:#102012; font-size:28px; line-height:1.1;">${content}</h2>`,
    paragraph: `<p style="margin:0 0 16px; color:#405246; font-size:16px; line-height:1.7;">${content}</p>`,
    bold: `<strong>${content}</strong>`,
    button: `<a href="{{team_website}}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#32ce32; color:#051005; font-weight:700; text-decoration:none;">${selectedText || "Primary action"}</a>`,
    divider: `<hr style="margin:24px 0; border:none; border-top:1px solid #d4ead4;" />`,
    spacer: `<div style="height:24px; line-height:24px;">&nbsp;</div>`
  };

  return snippets[actionId] || content;
}

export function getTemplateBlockMarkup(blockId) {
  return templateBlockLibrary.find((block) => block.id === blockId)?.html || "";
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
