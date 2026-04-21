const baseTemplate = {
  id: "",
  name: "",
  category: "General",
  subject: "",
  html: "",
  createdAt: "",
  updatedAt: ""
};

export function createTemplate(input = {}) {
  const now = new Date().toISOString();

  return {
    ...baseTemplate,
    id: input.id || crypto.randomUUID(),
    name: input.name ?? "Untitled Template",
    category: input.category ?? "General",
    subject: input.subject ?? "",
    html: input.html ?? "",
    createdAt: input.createdAt ?? input.created_at ?? now,
    updatedAt: input.updatedAt ?? input.updated_at ?? now
  };
}

export function serializeTemplateForApi(template) {
  const normalized = createTemplate(template);

  return {
    id: normalized.id,
    name: normalized.name,
    category: normalized.category,
    subject: normalized.subject,
    html: normalized.html
  };
}

export function deserializeTemplateFromApi(record) {
  return createTemplate(record);
}
