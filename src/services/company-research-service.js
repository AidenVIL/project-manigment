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
    throw new Error(payload.error || "Company research failed.");
  }

  return payload;
}

export const companyResearchService = {
  async researchCompany(input) {
    return request("/api/company-research", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};
