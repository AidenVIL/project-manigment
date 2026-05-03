const HISTORY_KEY = "atomic_intelligence_chat_history_v1";
const CONVERSATIONS_KEY = "atomic_intelligence_conversations_v1";

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export const atomicIntelligenceService = {
  loadHistory() {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = safeJson(raw || "[]", []);
    return Array.isArray(parsed) ? parsed : [];
  },
  saveHistory(messages = []) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage failures in private mode/quota limits.
    }
  },
  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore storage failures.
    }
  },
  loadConversations() {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    const parsed = safeJson(raw || "[]", []);
    return ensureArray(parsed, []);
  },
  saveConversations(conversations = []) {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(ensureArray(conversations, [])));
    } catch {
      // Ignore storage failures in private mode/quota limits.
    }
  },
  saveConversation(conversation = {}) {
    const conversations = this.loadConversations();
    const existingIndex = conversations.findIndex((entry) => entry.id === conversation.id);
    if (existingIndex > -1) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }
    this.saveConversations(conversations);
    return conversations;
  },
  async chat({ question = "", mode = "research", companies = [] } = {}) {
    const response = await fetch("/api/atomic-intelligence/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        question,
        mode,
        companies
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Atomic Intelligence request failed.");
    }

    return response.json();
  },
  async askAssistant({
    message = "",
    context = "",
    useWebSearch,
    maxOutputTokens
  } = {}) {
    const body = {
      message,
      context
    };

    if (typeof useWebSearch === "boolean") {
      body.useWebSearch = useWebSearch;
    }

    if (maxOutputTokens) {
      body.maxOutputTokens = maxOutputTokens;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "AI assistant request failed.");
    }

    return response.json();
  },
  async assistEmail({
    mode = "first_outreach",
    company = {},
    contact = {},
    subject = "",
    html = "",
    plainText = "",
    instruction = ""
  } = {}) {
    const response = await fetch("/api/atomic-intelligence/email-assist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        mode,
        company,
        contact,
        subject,
        html,
        plainText,
        instruction
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Email assist request failed.");
    }

    return response.json();
  }
};
