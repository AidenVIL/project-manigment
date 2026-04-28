const HISTORY_KEY = "atomic_intelligence_chat_history_v1";

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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
  }
};

