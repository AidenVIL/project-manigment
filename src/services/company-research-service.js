function normalizeApiErrorMessage(response, payload) {
  const fallbackMessage =
    response.status >= 500
      ? "The company finder is temporarily unavailable. Please try again in a minute."
      : "Company research failed.";
  const rawError = typeof payload?.error === "string" ? payload.error.trim() : "";
  const looksLikeHtml = /<(?:!doctype|html|head|body)\b/i.test(rawError);

  if (!rawError || looksLikeHtml) {
    return fallbackMessage;
  }

  if (response.status >= 500 && /^server error:/i.test(rawError)) {
    return fallbackMessage;
  }

  return rawError;
}

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
    throw new Error(normalizeApiErrorMessage(response, payload));
  }

  return payload;
}

export const companyResearchService = {
  async researchCompany(input) {
    return request("/api/company-research", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  async externalSponsorSearch(input) {
    return request("/api/external-sponsor-search", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};
