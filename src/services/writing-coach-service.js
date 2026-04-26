function replaceTokens(text = "", tokens = {}) {
  return String(text || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, token) => {
    return tokens[token] ?? token.replace(/_/g, " ");
  });
}

function collectDraftText(design, tokens) {
  if (!design?.blocks?.length) {
    return "";
  }

  return design.blocks
    .map((block) => {
      if (block.type === "heading" || block.type === "paragraph") {
        return replaceTokens(block.content?.text || "", tokens);
      }

      if (block.type === "button") {
        return replaceTokens(block.content?.label || "", tokens);
      }

      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildSnippet(text, index, length = 20, radius = 36) {
  if (!text || index < 0) {
    return "";
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`.trim();
}

function detectTone(text) {
  const normalized = text.toLowerCase();
  const casualMarkers = ["hey", "awesome", "super", "gonna", "wanna", "kinda", "cool"];
  const urgentMarkers = ["urgent", "asap", "immediately", "right away", "today"];
  const warmMarkers = ["thank you", "appreciate", "happy to", "would love", "glad"];

  const casualHits = casualMarkers.filter((marker) => normalized.includes(marker)).length;
  const urgentHits = urgentMarkers.filter((marker) => normalized.includes(marker)).length;
  const warmHits = warmMarkers.filter((marker) => normalized.includes(marker)).length;

  if (urgentHits > 0) {
    return {
      label: "Urgent",
      note: "The email reads as a bit pushy. Softening the wording may feel more professional."
    };
  }

  if (casualHits > 1) {
    return {
      label: "Casual",
      note: "The copy feels friendly but a little informal for sponsor outreach."
    };
  }

  if (warmHits > 0) {
    return {
      label: "Warm Professional",
      note: "The tone feels friendly, confident, and sponsor-ready."
    };
  }

  return {
    label: "Professional",
    note: "The wording is clear and businesslike, but could use a touch more warmth."
  };
}

function buildSuggestions(subject, bodyText) {
  const combined = `${subject}\n${bodyText}`.trim();
  const suggestions = [];
  const pushSuggestion = (title, detail, snippet = "") => {
    if (suggestions.some((item) => item.title === title)) {
      return;
    }

    suggestions.push({ title, detail, snippet });
  };

  if (!subject.trim()) {
    pushSuggestion(
      "Add a subject line",
      "A clear subject helps the message feel complete and easier to track."
    );
  }

  const extraSpacesMatch = combined.match(/ {2,}/);
  if (extraSpacesMatch?.index != null) {
    pushSuggestion(
      "Trim extra spaces",
      "There are double spaces in the draft that can make the email look unfinished.",
      buildSnippet(combined, extraSpacesMatch.index, extraSpacesMatch[0].length)
    );
  }

  const lowercaseIMatch = combined.match(/\bi\b/);
  if (lowercaseIMatch?.index != null) {
    pushSuggestion(
      "Capitalise standalone 'I'",
      "There is at least one lowercase 'i' that should be capitalised.",
      buildSnippet(combined, lowercaseIMatch.index, lowercaseIMatch[0].length)
    );
  }

  const sentenceCaseMatch = combined.match(/(^|[.!?]\s+)([a-z])/);
  if (sentenceCaseMatch?.index != null) {
    pushSuggestion(
      "Check sentence capitals",
      "One or more sentences may start with a lowercase letter.",
      buildSnippet(combined, sentenceCaseMatch.index, sentenceCaseMatch[0].length)
    );
  }

  const repeatedWordMatch = combined.match(/(\b\w+\b)\s+\1\b/i);
  if (repeatedWordMatch?.index != null) {
    pushSuggestion(
      "Remove repeated words",
      "There is a repeated word in the draft that reads like a typo.",
      buildSnippet(combined, repeatedWordMatch.index, repeatedWordMatch[0].length)
    );
  }

  const punctuationBurstMatch = combined.match(/!!+|\?\?+/);
  if (punctuationBurstMatch?.index != null) {
    pushSuggestion(
      "Tone down punctuation",
      "Multiple exclamation or question marks can make the email feel too intense.",
      buildSnippet(combined, punctuationBurstMatch.index, punctuationBurstMatch[0].length)
    );
  }

  const longSentence = bodyText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.split(/\s+/).filter(Boolean).length > 30);
  if (longSentence) {
    pushSuggestion(
      "Break up long sentences",
      "One of the sentences is quite long. Shorter lines will read more cleanly.",
      longSentence.slice(0, 140)
    );
  }

  if (!/\b(hi|dear)\b/i.test(bodyText)) {
    pushSuggestion("Add a greeting", "Starting with a simple greeting can make the outreach feel more personal.");
  }

  if (!/\b(best|regards|thanks|thank you)\b/i.test(bodyText)) {
    pushSuggestion("Add a stronger close", "A clear sign-off helps the draft feel finished and more polished.");
  }

  if (!/\?|\blet me know\b|\bhappy to\b|\bwould love to\b/i.test(bodyText)) {
    pushSuggestion("Include a call to action", "The draft would benefit from a clear next step or invitation to reply.");
  }

  const spellingPatterns = [
    { pattern: /\brecieve\b/i, fix: "receive" },
    { pattern: /\bseperate\b/i, fix: "separate" },
    { pattern: /\bdefinately\b/i, fix: "definitely" },
    { pattern: /\bwich\b/i, fix: "which" },
    { pattern: /\bteh\b/i, fix: "the" }
  ];

  spellingPatterns.forEach(({ pattern, fix }) => {
    const match = combined.match(pattern);
    if (match?.index != null) {
      pushSuggestion(
        "Possible spelling issue",
        `One word looks misspelled. A likely correction is "${fix}".`,
        buildSnippet(combined, match.index, match[0].length)
      );
    }
  });

  return suggestions.slice(0, 8);
}

export function analyzeEmailWriting({ subject = "", design = null, tokens = {} } = {}) {
  const renderedSubject = replaceTokens(subject, tokens).trim();
  const bodyText = collectDraftText(design, tokens).trim();
  const combined = [renderedSubject, bodyText].filter(Boolean).join("\n\n");
  const words = combined.split(/\s+/).filter(Boolean);

  return {
    tone: detectTone(combined),
    wordCount: words.length,
    readingTime: Math.max(1, Math.round(words.length / 180)),
    suggestions: buildSuggestions(renderedSubject, bodyText)
  };
}
