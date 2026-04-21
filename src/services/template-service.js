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

const defaultCanvas = {
  bodyBackground: "#202522",
  emailBackground: "#ffffff",
  width: 680,
  radius: 0,
  fontFamily: "Arial, sans-serif"
};

function createId() {
  return crypto.randomUUID();
}

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

export const variableDefinitions = [
  {
    id: "team",
    label: "Team Details",
    items: [
      { token: "{{team_name}}", label: "Team Name", key: "team_name", help: "Atomic team name" },
      { token: "{{season_label}}", label: "Season Label", key: "season_label", help: "Current season or campaign" },
      { token: "{{team_signature}}", label: "Team Signature", key: "team_signature", help: "How the email signs off" },
      { token: "{{team_website}}", label: "Team Website", key: "team_website", help: "Main site or sponsor deck link" }
    ]
  },
  {
    id: "company",
    label: "Company Details",
    items: [
      { token: "{{company_name}}", label: "Company Name", key: "company_name", help: "The company you are emailing" },
      { token: "{{contribution_type}}", label: "Support Type", key: "contribution_type", help: "What they may give" },
      { token: "{{contribution_value}}", label: "Support Value", key: "contribution_value", help: "Value of confirmed support" }
    ]
  },
  {
    id: "contact",
    label: "Contact Details",
    items: [
      { token: "{{contact_first_name}}", label: "Contact First Name", key: "contact_first_name", help: "Friendly greeting name" },
      { token: "{{contact_full_name}}", label: "Contact Full Name", key: "contact_full_name", help: "Full contact name" },
      { token: "{{contact_email}}", label: "Contact Email", key: "contact_email", help: "Saved contact email address" }
    ]
  },
  {
    id: "sponsorship",
    label: "Sponsorship Ask",
    items: [
      { token: "{{ask_type}}", label: "Ask Type", key: "ask_type", help: "Cash, machining, media and so on" },
      { token: "{{ask_value}}", label: "Ask Value", key: "ask_value", help: "How much support you are asking for" },
      { token: "{{request_from_us}}", label: "What They Want From Us", key: "request_from_us", help: "Requested deliverables" },
      { token: "{{giving_in_return}}", label: "What They Are Giving", key: "giving_in_return", help: "Offer or return package" }
    ]
  },
  {
    id: "timeline",
    label: "Timeline",
    items: [
      { token: "{{next_follow_up}}", label: "Next Follow-Up", key: "next_follow_up", help: "Scheduled follow-up date" },
      { token: "{{proposal_date}}", label: "Proposal Date", key: "proposal_date", help: "Proposal or milestone date" }
    ]
  }
];

export const editorTabs = [
  { id: "layers", label: "Structure" },
  { id: "blocks", label: "Add" }
];

export const blockDefinitions = [
  { id: "heading", label: "Heading" },
  { id: "paragraph", label: "Paragraph" },
  { id: "image", label: "Image" },
  { id: "button", label: "Button" },
  { id: "divider", label: "Divider" },
  { id: "spacer", label: "Spacer" }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function createBlock(type, overrides = {}) {
  const baseBlocks = {
    heading: {
      id: createId(),
      type: "heading",
      name: "Heading",
      content: { text: "Heading text" },
      styles: {
        align: "center",
        color: "#111111",
        fontSize: 42,
        fontWeight: 700,
        paddingTop: 24,
        paddingBottom: 16,
        paddingX: 40
      }
    },
    paragraph: {
      id: createId(),
      type: "paragraph",
      name: "Paragraph",
      content: { text: "Write your message here." },
      styles: {
        align: "center",
        color: "#4a4a4a",
        fontSize: 16,
        lineHeight: 1.7,
        paddingTop: 0,
        paddingBottom: 18,
        paddingX: 40
      }
    },
    image: {
      id: createId(),
      type: "image",
      name: "Image",
      content: { src: APP_CONFIG.logoPath, alt: APP_CONFIG.teamName },
      styles: {
        align: "left",
        width: 120,
        paddingTop: 28,
        paddingBottom: 18,
        paddingX: 32,
        backgroundColor: "#ffffff"
      }
    },
    button: {
      id: createId(),
      type: "button",
      name: "Button",
      content: { label: "View Team Website", url: "{{team_website}}" },
      styles: {
        align: "center",
        backgroundColor: APP_CONFIG.brand?.primary || "#32ce32",
        color: "#041004",
        radius: 999,
        fontSize: 15,
        fontWeight: 700,
        paddingTop: 14,
        paddingBottom: 14,
        paddingX: 24,
        outerPaddingTop: 8,
        outerPaddingBottom: 24
      }
    },
    divider: {
      id: createId(),
      type: "divider",
      name: "Divider",
      content: {},
      styles: {
        color: "#d9e5d9",
        paddingTop: 24,
        paddingBottom: 24,
        paddingX: 40
      }
    },
    spacer: {
      id: createId(),
      type: "spacer",
      name: "Spacer",
      content: {},
      styles: {
        height: 28
      }
    }
  };

  const base = clone(baseBlocks[type] || baseBlocks.paragraph);
  return {
    ...base,
    ...overrides,
    content: {
      ...base.content,
      ...(overrides.content || {})
    },
    styles: {
      ...base.styles,
      ...(overrides.styles || {})
    }
  };
}

export function createDefaultTemplateDesign(overrides = {}) {
  const baseDesign = {
    canvas: { ...defaultCanvas },
    blocks: [
      createBlock("image", {
        name: "Logo",
        styles: { align: "left", width: 118, paddingTop: 22, paddingBottom: 16, paddingX: 28 }
      }),
      createBlock("paragraph", {
        name: "Eyebrow",
        content: { text: "SPONSOR OUTREACH" },
        styles: {
          align: "center",
          color: "#1a211a",
          fontSize: 13,
          fontWeight: 700,
          paddingTop: 8,
          paddingBottom: 12,
          paddingX: 40
        }
      }),
      createBlock("heading", {
        name: "Main Heading",
        content: { text: "Partner with {{team_name}}" },
        styles: {
          align: "center",
          color: "#111111",
          fontSize: 42,
          fontWeight: 700,
          paddingTop: 0,
          paddingBottom: 16,
          paddingX: 40
        }
      }),
      createBlock("paragraph", {
        name: "Intro Paragraph",
        content: {
          text: "Hi {{contact_first_name}},\n\nWe are reaching out from {{team_name}} because we think {{company_name}} could be a great fit for a performance-led partnership."
        }
      }),
      createBlock("paragraph", {
        name: "Offer Paragraph",
        content: {
          text: "We are currently seeking support around {{ask_type}} with a target value of {{ask_value}}, and we would love to tailor the package around what matters most to your team."
        }
      }),
      createBlock("button"),
      createBlock("paragraph", {
        name: "Sign-Off",
        content: { text: "Best,\n{{team_signature}}" },
        styles: {
          align: "left",
          color: "#3f4c3f",
          fontSize: 15,
          lineHeight: 1.7,
          paddingTop: 0,
          paddingBottom: 28,
          paddingX: 40
        }
      })
    ]
  };

  const merged = {
    canvas: {
      ...baseDesign.canvas,
      ...(overrides.canvas || {})
    },
    blocks: overrides.blocks ? overrides.blocks.map((block) => normalizeBlock(block)) : baseDesign.blocks
  };

  return merged;
}

export function normalizeBlock(block) {
  return createBlock(block.type, block);
}

export function normalizeTemplateDesign(design) {
  if (!design || !Array.isArray(design.blocks) || !design.blocks.length) {
    return createDefaultTemplateDesign();
  }

  return {
    canvas: {
      ...defaultCanvas,
      ...(design.canvas || {})
    },
    blocks: design.blocks.map((block) => normalizeBlock(block))
  };
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

function renderTextContent(text, company) {
  return escapeHtml(applyTokens(text, company)).replace(/\n/g, "<br />");
}

export function renderBlockHtml(block, company = {}, canvas = defaultCanvas) {
  const styles = block.styles || {};
  const align = styles.align || "left";
  const wrapperPaddingTop = Number(styles.outerPaddingTop ?? styles.paddingTop ?? 0);
  const wrapperPaddingBottom = Number(styles.outerPaddingBottom ?? styles.paddingBottom ?? 0);
  const wrapperStyle = [
    `padding-top:${wrapperPaddingTop}px`,
    `padding-bottom:${wrapperPaddingBottom}px`,
    `padding-left:${Number(styles.paddingX ?? 0)}px`,
    `padding-right:${Number(styles.paddingX ?? 0)}px`,
    styles.backgroundColor ? `background:${styles.backgroundColor}` : ""
  ].filter(Boolean).join(";");

  if (block.type === "image") {
    return `<div style="${wrapperStyle}; text-align:${align};"><img src="${escapeAttribute(
      applyTokens(block.content.src || "", company)
    )}" alt="${escapeAttribute(block.content.alt || "")}" style="display:inline-block; width:${Number(
      styles.width || 120
    )}px; max-width:100%; border:0;" /></div>`;
  }

  if (block.type === "heading") {
    return `<div style="${wrapperStyle}; text-align:${align};"><h1 style="margin:0; color:${styles.color || "#111111"}; font-size:${Number(
      styles.fontSize || 40
    )}px; line-height:1.12; font-weight:${Number(styles.fontWeight || 700)}; font-family:${canvas.fontFamily};">${renderTextContent(
      block.content.text || "",
      company
    )}</h1></div>`;
  }

  if (block.type === "paragraph") {
    return `<div style="${wrapperStyle}; text-align:${align};"><p style="margin:0; color:${styles.color || "#4a4a4a"}; font-size:${Number(
      styles.fontSize || 16
    )}px; line-height:${Number(styles.lineHeight || 1.7)}; font-weight:${Number(
      styles.fontWeight || 400
    )}; font-family:${canvas.fontFamily};">${renderTextContent(
      block.content.text || "",
      company
    )}</p></div>`;
  }

  if (block.type === "button") {
    return `<div style="${wrapperStyle}; text-align:${align};"><a href="${escapeAttribute(
      applyTokens(block.content.url || "", company)
    )}" style="display:inline-block; background:${styles.backgroundColor || "#32ce32"}; color:${styles.color || "#041004"}; border-radius:${Number(
      styles.radius || 999
    )}px; font-size:${Number(styles.fontSize || 15)}px; line-height:1; font-weight:${Number(
      styles.fontWeight || 700
    )}; text-decoration:none; padding:${Number(styles.paddingTop || 14)}px ${Number(
      styles.paddingX || 24
    )}px; font-family:${canvas.fontFamily};">${renderTextContent(
      block.content.label || "Button",
      company
    )}</a></div>`;
  }

  if (block.type === "divider") {
    return `<div style="${wrapperStyle};"><hr style="border:none; border-top:1px solid ${styles.color || "#d9e5d9"}; margin:0;" /></div>`;
  }

  if (block.type === "spacer") {
    return `<div style="height:${Number(styles.height || 24)}px; line-height:${Number(
      styles.height || 24
    )}px;">&nbsp;</div>`;
  }

  return `<div style="${wrapperStyle};">${escapeHtml(String(block.content?.text || ""))}</div>`;
}

export function renderTemplateHtmlFromDesign(design, company = {}) {
  const normalizedDesign = normalizeTemplateDesign(design);
  const blocksHtml = normalizedDesign.blocks
    .map((block) => renderBlockHtml(block, company, normalizedDesign.canvas))
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${normalizedDesign.canvas.bodyBackground}; padding:24px 0; font-family:${normalizedDesign.canvas.fontFamily};">
  <tr>
    <td align="center">
      <table role="presentation" width="${Number(normalizedDesign.canvas.width || 680)}" cellpadding="0" cellspacing="0" style="width:${Number(
    normalizedDesign.canvas.width || 680
  )}px; max-width:100%; background:${normalizedDesign.canvas.emailBackground}; border-radius:${Number(
    normalizedDesign.canvas.radius || 0
  )}px; overflow:hidden;">
        <tr>
          <td>${blocksHtml}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function sortTemplates(templates) {
  return [...templates].sort((left, right) => left.name.localeCompare(right.name));
}

function readStoredTemplates() {
  return storageService
    .read(STORAGE_KEYS.templates, [])
    .map((template) => createTemplate(template));
}

function createLegacyDesignFromHtml(html = "") {
  return {
    canvas: { ...defaultCanvas },
    blocks: [
      {
        id: createId(),
        type: "paragraph",
        name: "Legacy HTML",
        content: { text: "This template was created before the visual editor. Replace it with new blocks." },
        styles: {
          align: "left",
          color: "#4a4a4a",
          fontSize: 16,
          lineHeight: 1.7,
          paddingTop: 24,
          paddingBottom: 24,
          paddingX: 32
        }
      },
      {
        id: createId(),
        type: "paragraph",
        name: "Legacy Source",
        content: { text: html },
        styles: {
          align: "left",
          color: "#4a4a4a",
          fontSize: 13,
          lineHeight: 1.6,
          paddingTop: 0,
          paddingBottom: 28,
          paddingX: 32
        }
      }
    ]
  };
}

export function ensureTemplateDesign(template) {
  return normalizeTemplateDesign(template.design || createLegacyDesignFromHtml(template.html));
}

function createTemplateFromSeed(seed) {
  const template = createTemplate(seed);
  const design = ensureTemplateDesign(template);
  return {
    ...template,
    design,
    html: renderTemplateHtmlFromDesign(design)
  };
}

export const templateService = {
  async loadTemplates() {
    if (supabaseService.isReady()) {
      const records = await supabaseService.list("email_templates");
      const templates = sortTemplates(
        records.map((record) => {
          const template = deserializeTemplateFromApi(record);
          const design = ensureTemplateDesign(template);
          return {
            ...template,
            design,
            html: renderTemplateHtmlFromDesign(design)
          };
        })
      );
      storageService.write(STORAGE_KEYS.templates, templates);
      return templates;
    }

    const storedTemplates = readStoredTemplates();
    if (storedTemplates.length) {
      return sortTemplates(
        storedTemplates.map((template) => {
          const design = ensureTemplateDesign(template);
          return {
            ...template,
            design,
            html: renderTemplateHtmlFromDesign(design)
          };
        })
      );
    }

    const templates = sortTemplates(seedTemplates.map(createTemplateFromSeed));
    storageService.write(STORAGE_KEYS.templates, templates);
    return templates;
  },
  async saveTemplate(input) {
    const normalizedDesign = ensureTemplateDesign(input);
    const template = createTemplate({
      ...input,
      design: normalizedDesign,
      html: renderTemplateHtmlFromDesign(normalizedDesign),
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
    const design = ensureTemplateDesign(normalized);
    return {
      subject: applyTokens(normalized.subject, company),
      html: renderTemplateHtmlFromDesign(design, company),
      tokens: getTokenMap(company)
    };
  },
  createStarterTemplate(index) {
    const design = createDefaultTemplateDesign({
      blocks: [
        createBlock("image", {
          name: "Logo",
          styles: { align: "left", width: 118, paddingTop: 26, paddingBottom: 18, paddingX: 28 }
        }),
        createBlock("paragraph", {
          name: "Eyebrow",
          content: { text: "ATOMIC PARTNER GRID" },
          styles: {
            align: "center",
            color: "#1a211a",
            fontSize: 13,
            fontWeight: 700,
            paddingTop: 6,
            paddingBottom: 12,
            paddingX: 40
          }
        }),
        createBlock("heading", {
          name: "Headline",
          content: { text: "Update for {{company_name}}" },
          styles: {
            align: "center",
            color: "#111111",
            fontSize: 40,
            fontWeight: 700,
            paddingTop: 0,
            paddingBottom: 16,
            paddingX: 40
          }
        }),
        createBlock("paragraph", {
          name: "Body Copy",
          content: {
            text: "Hi {{contact_first_name}},\n\nI wanted to share a quick update from {{team_name}} and keep our conversation moving with a package around {{ask_type}}."
          }
        }),
        createBlock("button", {
          content: { label: "Open Team Website", url: "{{team_website}}" }
        }),
        createBlock("paragraph", {
          name: "Closing",
          content: { text: "Best,\n{{team_signature}}" },
          styles: {
            align: "left",
            color: "#3f4c3f",
            fontSize: 15,
            lineHeight: 1.7,
            paddingTop: 0,
            paddingBottom: 28,
            paddingX: 40
          }
        })
      ]
    });

    return createTemplate({
      name: `Atomic Template ${index}`,
      category: "Custom",
      subject: "{{team_name}} update for {{company_name}}",
      design,
      html: renderTemplateHtmlFromDesign(design)
    });
  },
  createBlock,
  normalizeTemplateDesign,
  renderTemplateHtmlFromDesign
};
