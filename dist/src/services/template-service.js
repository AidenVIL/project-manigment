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
  bodyBackground: "#eef5ea",
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

const importContainerTags = new Set([
  "BODY",
  "HTML",
  "TABLE",
  "TBODY",
  "THEAD",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "DIV",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "HEADER",
  "FOOTER",
  "CENTER"
]);

const importIgnoredTags = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "HEAD",
  "TITLE",
  "NOSCRIPT",
  "SVG",
  "PATH"
]);

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

function duplicateBlock(block) {
  const copy = createBlock(block.type, clone(block));
  copy.id = createId();
  copy.name = `${block.name || block.type} Copy`;
  return copy;
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

function parseStyleAttribute(value = "") {
  return String(value)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((styles, part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex < 0) {
        return styles;
      }

      const key = part.slice(0, separatorIndex).trim().toLowerCase();
      const styleValue = part.slice(separatorIndex + 1).trim();
      if (!key) {
        return styles;
      }

      styles[key] = styleValue;
      return styles;
    }, {});
}

function readStyleValue(styles, keys, fallback = "") {
  for (const key of keys) {
    if (styles[key]) {
      return styles[key];
    }
  }

  return fallback;
}

function readPixelValue(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const match = String(value).match(/-?\d+(\.\d+)?/);
  if (!match) {
    return fallback;
  }

  const number = Number(match[0]);
  return Number.isFinite(number) ? number : fallback;
}

function readNumericValue(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

function normalizeImportedAlign(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return ["left", "center", "right"].includes(normalized) ? normalized : "left";
}

function normalizeImportedText(text = "") {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitImportedText(text = "") {
  return normalizeImportedText(text)
    .split(/\n{2,}/)
    .map((part) => normalizeImportedText(part))
    .filter(Boolean);
}

function getElementText(element) {
  if (!element) {
    return "";
  }

  const text = element.tagName === "LI" ? `- ${element.textContent || ""}` : element.textContent || "";
  return normalizeImportedText(text);
}

function getImportedTextColor(styles, fallback) {
  return readStyleValue(styles, ["color"], fallback);
}

function getImportedBackground(styles, fallback = "") {
  return readStyleValue(styles, ["background-color", "background"], fallback);
}

function getImportedAlign(element, styles) {
  return normalizeImportedAlign(
    readStyleValue(styles, ["text-align"], element.getAttribute("align") || "left")
  );
}

function getImportedPaddingX(styles, fallback = 40) {
  return readPixelValue(readStyleValue(styles, ["padding-left", "padding"]), fallback);
}

function getImportedPaddingTop(styles, fallback = 0) {
  return readPixelValue(readStyleValue(styles, ["padding-top", "padding"]), fallback);
}

function getImportedPaddingBottom(styles, fallback = 18) {
  return readPixelValue(readStyleValue(styles, ["padding-bottom", "padding"]), fallback);
}

function buildImportedContext(element, inheritedContext = {}) {
  const styles = parseStyleAttribute(element?.getAttribute?.("style"));

  return {
    align: getImportedAlign(element, styles) || inheritedContext.align || "left",
    color: getImportedTextColor(styles, inheritedContext.color || ""),
    backgroundColor: getImportedBackground(styles, inheritedContext.backgroundColor || ""),
    fontSize: readPixelValue(readStyleValue(styles, ["font-size"]), inheritedContext.fontSize),
    fontWeight: readNumericValue(readStyleValue(styles, ["font-weight"]), inheritedContext.fontWeight),
    lineHeight:
      Number(readStyleValue(styles, ["line-height"], inheritedContext.lineHeight || "")) ||
      inheritedContext.lineHeight ||
      1.7,
    paddingX: getImportedPaddingX(styles, inheritedContext.paddingX ?? 40),
    paddingTop: getImportedPaddingTop(styles, inheritedContext.paddingTop ?? 0),
    paddingBottom: getImportedPaddingBottom(styles, inheritedContext.paddingBottom ?? 18),
    width: readPixelValue(
      element?.getAttribute?.("width") || readStyleValue(styles, ["width"]),
      inheritedContext.width
    ),
    radius: readPixelValue(readStyleValue(styles, ["border-radius"]), inheritedContext.radius)
  };
}

function sanitizeImportedUrl(url = "") {
  const trimmed = String(url || "").trim();
  return trimmed || "";
}

function buildImportedBlockName(type, index) {
  const labels = {
    heading: "Heading",
    paragraph: "Paragraph",
    image: "Image",
    button: "Button",
    divider: "Divider",
    spacer: "Spacer"
  };

  return `${labels[type] || "Block"} ${index}`;
}

function createImportedHeadingBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));
  const tagName = element.tagName.toUpperCase();
  const sizeMap = {
    H1: 44,
    H2: 34,
    H3: 28,
    H4: 24,
    H5: 20,
    H6: 18
  };
  const text = getElementText(element);

  if (!text) {
    return null;
  }

  return createBlock("heading", {
    name: buildImportedBlockName("heading", index),
    content: { text },
    styles: {
      align: getImportedAlign(element, styles) || context.align || "center",
      color: getImportedTextColor(styles, context.color || "#111111"),
      fontSize: readPixelValue(
        readStyleValue(styles, ["font-size"]),
        context.fontSize || sizeMap[tagName] || 32
      ),
      fontWeight: readNumericValue(readStyleValue(styles, ["font-weight"]), context.fontWeight || 700),
      paddingTop: getImportedPaddingTop(styles, context.paddingTop ?? 12),
      paddingBottom: getImportedPaddingBottom(styles, context.paddingBottom ?? 14),
      paddingX: getImportedPaddingX(styles, context.paddingX ?? 40),
      backgroundColor: getImportedBackground(styles, context.backgroundColor || "")
    }
  });
}

function createImportedParagraphBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));
  const text = getElementText(element);

  if (!text) {
    return null;
  }

  return createBlock("paragraph", {
    name: buildImportedBlockName("paragraph", index),
    content: { text },
    styles: {
      align: getImportedAlign(element, styles) || context.align || "left",
      color: getImportedTextColor(styles, context.color || "#4a4a4a"),
      fontSize: readPixelValue(readStyleValue(styles, ["font-size"]), context.fontSize || 16),
      fontWeight: readNumericValue(readStyleValue(styles, ["font-weight"]), context.fontWeight || 400),
      lineHeight:
        Number(readStyleValue(styles, ["line-height"], context.lineHeight || 1.7)) ||
        context.lineHeight ||
        1.7,
      paddingTop: getImportedPaddingTop(styles, context.paddingTop ?? 4),
      paddingBottom: getImportedPaddingBottom(styles, context.paddingBottom ?? 18),
      paddingX: getImportedPaddingX(styles, context.paddingX ?? 40),
      backgroundColor: getImportedBackground(styles, context.backgroundColor || "")
    }
  });
}

function createImportedImageBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));
  const src = sanitizeImportedUrl(element.getAttribute("src") || element.getAttribute("data-src"));

  if (!src) {
    return null;
  }

  return createBlock("image", {
    name: buildImportedBlockName("image", index),
    content: {
      src,
      alt: element.getAttribute("alt") || ""
    },
    styles: {
      align: getImportedAlign(element, styles) || context.align || "left",
      width: readPixelValue(
        element.getAttribute("width") || readStyleValue(styles, ["width"]),
        context.width || 240
      ),
      paddingTop: getImportedPaddingTop(styles, context.paddingTop ?? 12),
      paddingBottom: getImportedPaddingBottom(styles, context.paddingBottom ?? 12),
      paddingX: getImportedPaddingX(styles, context.paddingX ?? 24),
      backgroundColor: getImportedBackground(styles, context.backgroundColor || "#ffffff")
    }
  });
}

function isButtonLikeAnchor(element, text, styles) {
  const className = element.getAttribute("class") || "";
  return Boolean(
    element.getAttribute("href") &&
      text &&
      (
        readStyleValue(styles, ["background", "background-color"]) ||
        readStyleValue(styles, ["border", "border-radius"]) ||
        /btn|button|cta/i.test(className) ||
        text.length <= 40
      )
  );
}

function createImportedButtonBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));
  const label = getElementText(element);
  if (!isButtonLikeAnchor(element, label, styles)) {
    return null;
  }

  return createBlock("button", {
    name: buildImportedBlockName("button", index),
    content: {
      label,
      url: sanitizeImportedUrl(element.getAttribute("href"))
    },
    styles: {
      align: getImportedAlign(element, styles) || context.align || "center",
      backgroundColor: getImportedBackground(
        styles,
        context.backgroundColor || APP_CONFIG.brand?.primary || "#32ce32"
      ),
      color: getImportedTextColor(styles, context.color || "#041004"),
      radius: readPixelValue(readStyleValue(styles, ["border-radius"]), context.radius || 999),
      fontSize: readPixelValue(readStyleValue(styles, ["font-size"]), context.fontSize || 15),
      fontWeight: readNumericValue(readStyleValue(styles, ["font-weight"]), context.fontWeight || 700),
      paddingTop: readPixelValue(readStyleValue(styles, ["padding-top"]), context.paddingTop ?? 14),
      paddingBottom: readPixelValue(readStyleValue(styles, ["padding-bottom"]), context.paddingBottom ?? 14),
      paddingX: getImportedPaddingX(styles, context.paddingX ?? 24),
      outerPaddingTop: getImportedPaddingTop(styles, context.paddingTop ?? 8),
      outerPaddingBottom: getImportedPaddingBottom(styles, context.paddingBottom ?? 20)
    }
  });
}

function createImportedDividerBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));

  return createBlock("divider", {
    name: buildImportedBlockName("divider", index),
    styles: {
      color: readStyleValue(styles, ["border-color", "color"], context.color || "#d9e5d9"),
      paddingTop: getImportedPaddingTop(styles, context.paddingTop ?? 18),
      paddingBottom: getImportedPaddingBottom(styles, context.paddingBottom ?? 18),
      paddingX: getImportedPaddingX(styles, context.paddingX ?? 40)
    }
  });
}

function createImportedSpacerBlock(element, index, context = {}) {
  const styles = parseStyleAttribute(element.getAttribute("style"));
  const height = readPixelValue(
    readStyleValue(styles, ["height", "min-height", "padding-top", "padding-bottom"]),
    context.paddingBottom || context.paddingTop || 24
  );

  if (!height || height < 18) {
    return null;
  }

  return createBlock("spacer", {
    name: buildImportedBlockName("spacer", index),
    styles: {
      height
    }
  });
}

function createImportedParagraphBlocksFromText(text, nextIndex, context = {}) {
  return splitImportedText(text).map((part) =>
    createBlock("paragraph", {
      name: buildImportedBlockName("paragraph", nextIndex()),
      content: { text: part },
      styles: {
        align: context.align || "left",
        color: context.color || "#4a4a4a",
        fontSize: context.fontSize || 16,
        fontWeight: context.fontWeight || 400,
        lineHeight: context.lineHeight || 1.7,
        paddingTop: context.paddingTop ?? 4,
        paddingBottom: context.paddingBottom ?? 18,
        paddingX: context.paddingX ?? 40,
        backgroundColor: context.backgroundColor || ""
      }
    })
  );
}

function dedupeImportedBlocks(blocks) {
  return blocks.filter((block, index) => {
    const previous = blocks[index - 1];
    if (!previous) {
      return true;
    }

    if (block.type !== previous.type) {
      return true;
    }

    if (block.type === "spacer") {
      return Number(block.styles?.height || 0) !== Number(previous.styles?.height || 0);
    }

    if (block.type === "divider") {
      return false;
    }

    const blockText = normalizeImportedText(
      block.content?.text || block.content?.label || block.content?.src || ""
    );
    const previousText = normalizeImportedText(
      previous.content?.text || previous.content?.label || previous.content?.src || ""
    );

    return blockText !== previousText;
  });
}

function shouldIgnoreImportedElement(element) {
  return importIgnoredTags.has(element.tagName.toUpperCase());
}

function extractImportedBlocks(root) {
  const blocks = [];

  function visit(element, inheritedContext = {}) {
    if (!element || shouldIgnoreImportedElement(element)) {
      return;
    }

    const tagName = element.tagName.toUpperCase();
    const nextIndex = () => blocks.length + 1;
    const context = buildImportedContext(element, inheritedContext);

    if (tagName === "IMG") {
      const block = createImportedImageBlock(element, nextIndex(), context);
      if (block) {
        blocks.push(block);
      }
      return;
    }

    if (tagName === "HR") {
      blocks.push(createImportedDividerBlock(element, nextIndex(), context));
      return;
    }

    if (/^H[1-6]$/.test(tagName)) {
      const block = createImportedHeadingBlock(element, nextIndex(), context);
      if (block) {
        blocks.push(block);
      }
      return;
    }

    if (tagName === "A") {
      const block = createImportedButtonBlock(element, nextIndex(), context);
      if (block) {
        blocks.push(block);
        return;
      }
    }

    if (["P", "LI", "BLOCKQUOTE"].includes(tagName)) {
      createImportedParagraphBlocksFromText(getElementText(element), nextIndex, context).forEach((block) => {
        blocks.push(block);
      });
      return;
    }

    if (tagName === "TR") {
      const cells = Array.from(element.children).filter((child) => ["TD", "TH"].includes(child.tagName.toUpperCase()));

      if (cells.length) {
        cells.forEach((cell, index) => {
          const beforeCell = blocks.length;
          visit(cell, context);
          const addedBlocks = blocks.length - beforeCell;

          if (cells.length > 1 && addedBlocks > 0 && index < cells.length - 1) {
            const spacerBlock = createBlock("spacer", {
              name: buildImportedBlockName("spacer", nextIndex()),
              styles: { height: 18 }
            });
            blocks.push(spacerBlock);
          }
        });
        return;
      }
    }

    if (importContainerTags.has(tagName)) {
      const beforeChildren = blocks.length;
      Array.from(element.children).forEach((child) => visit(child, context));

      if (blocks.length > beforeChildren) {
        return;
      }

      const textBlocks = createImportedParagraphBlocksFromText(getElementText(element), nextIndex, context);
      if (textBlocks.length) {
        textBlocks.forEach((block) => blocks.push(block));
        return;
      }

      const spacerBlock = createImportedSpacerBlock(element, nextIndex(), context);
      if (spacerBlock) {
        blocks.push(spacerBlock);
      }
      return;
    }

    createImportedParagraphBlocksFromText(getElementText(element), nextIndex, context).forEach((block) => {
      blocks.push(block);
    });
  }

  Array.from(root.children).forEach((child) => visit(child, {}));
  return dedupeImportedBlocks(blocks);
}

function detectImportedCanvas(doc) {
  const body = doc.body;
  const bodyStyles = parseStyleAttribute(body?.getAttribute("style"));
  const firstSurface = body?.querySelector("table[style], div[style], section[style], article[style]");
  const surfaceStyles = parseStyleAttribute(firstSurface?.getAttribute?.("style") || "");

  return {
    ...defaultCanvas,
    bodyBackground: getImportedBackground(bodyStyles, defaultCanvas.bodyBackground),
    emailBackground: getImportedBackground(surfaceStyles, defaultCanvas.emailBackground),
    width: readPixelValue(
      firstSurface?.getAttribute?.("width") || readStyleValue(surfaceStyles, ["width"]),
      defaultCanvas.width
    ),
    radius: readPixelValue(readStyleValue(surfaceStyles, ["border-radius"]), defaultCanvas.radius)
  };
}

export function importTemplateHtml(html = "", options = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  const canvas = detectImportedCanvas(doc);
  const importedBlocks = extractImportedBlocks(doc.body);

  const blocks = importedBlocks.length
    ? importedBlocks
    : [
        createBlock("paragraph", {
          name: "Imported Content",
          content: {
            text:
              normalizeImportedText(doc.body?.textContent || "") ||
              "Imported HTML did not contain any recognisable editable blocks."
          },
          styles: {
            align: "left",
            color: "#4a4a4a",
            fontSize: 16,
            lineHeight: 1.7,
            paddingTop: 24,
            paddingBottom: 24,
            paddingX: 32
          }
        })
      ];

  return {
    name: options.name || doc.title || "Imported Template",
    subject: options.subject || "{{team_name}} update for {{company_name}}",
    design: normalizeTemplateDesign({
      canvas,
      blocks
    })
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
  const wrapperPaddingLeft = Number(styles.paddingLeft ?? styles.paddingX ?? 0);
  const wrapperPaddingRight = Number(styles.paddingRight ?? styles.paddingX ?? 0);
  const wrapperStyle = [
    `padding-top:${wrapperPaddingTop}px`,
    `padding-bottom:${wrapperPaddingBottom}px`,
    `padding-left:${wrapperPaddingLeft}px`,
    `padding-right:${wrapperPaddingRight}px`,
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
  return importTemplateHtml(html).design;
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

    if (supabaseService.isReady()) {
      await supabaseService.upsert("email_templates", serializeTemplateForApi(template));
    }

    const currentTemplates = readStoredTemplates();
    const exists = currentTemplates.some((item) => item.id === template.id);
    const nextTemplates = sortTemplates(
      exists
        ? currentTemplates.map((item) => (item.id === template.id ? template : item))
        : [...currentTemplates, template]
    );

    storageService.write(STORAGE_KEYS.templates, nextTemplates);

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
  createImportedTemplate({ name = "", subject = "", html = "" } = {}) {
    const imported = importTemplateHtml(html, { name, subject });

    return createTemplate({
      name: imported.name,
      category: "Imported",
      subject: imported.subject,
      design: imported.design,
      html: renderTemplateHtmlFromDesign(imported.design)
    });
  },
  createBlock,
  duplicateBlock,
  importTemplateHtml,
  normalizeTemplateDesign,
  renderTemplateHtmlFromDesign
};
