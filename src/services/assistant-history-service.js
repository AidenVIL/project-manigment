function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export const assistantHistoryService = {
  async loadConversations() {
    const response = await fetch("/api/assistant-history", {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Could not load saved AI chats.");
    }

    const payload = await response.json();
    return ensureArray(payload?.conversations, []);
  },

  async saveConversation(conversation = {}) {
    const response = await fetch("/api/assistant-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(conversation)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Could not save AI chat history.");
    }

    return response.json();
  }
};
