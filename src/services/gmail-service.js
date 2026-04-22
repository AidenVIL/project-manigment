async function request(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    },
    body: options.body
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : { error: await response.text() };

  if (!response.ok) {
    throw new Error(payload.error || "Gmail request failed.");
  }

  return payload;
}

export const gmailService = {
  async loadStatus() {
    return request("/api/gmail/status");
  },
  async loadMessages(query = "") {
    const search = new URLSearchParams();
    if (query) {
      search.set("q", query);
    }

    const payload = await request(`/api/gmail/messages${search.toString() ? `?${search.toString()}` : ""}`);
    return payload.messages || [];
  },
  async loadMessage(messageId) {
    const payload = await request(`/api/gmail/messages/${encodeURIComponent(messageId)}`);
    return payload.message || null;
  },
  async sendMessage(input) {
    return request("/api/gmail/send", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async disconnect() {
    return request("/api/gmail/disconnect", {
      method: "POST",
      body: JSON.stringify({})
    });
  },
  getConnectUrl() {
    return "/auth/google/start";
  }
};
