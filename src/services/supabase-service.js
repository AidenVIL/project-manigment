import { APP_CONFIG, isSupabaseConfigured } from "../config/runtime-config.js";
import { authService } from "./auth-service.js";

function buildHeaders(extraHeaders = {}) {
  const accessToken = authService.getAccessToken();

  return {
    "Content-Type": "application/json",
    apikey: APP_CONFIG.supabase.anonKey,
    Authorization: `Bearer ${accessToken || APP_CONFIG.supabase.anonKey}`,
    ...extraHeaders
  };
}

function buildFriendlySupabaseError(message = "") {
  const text = String(message || "");
  const missingColumnMatch = text.match(/Could not find the '([^']+)' column of '([^']+)'/);

  if (missingColumnMatch) {
    const [, columnName, tableName] = missingColumnMatch;

    if (tableName === "email_templates") {
      return `Supabase is missing the ${tableName}.${columnName} column. Run the SQL in supabase/schema.sql or supabase/fixes/add_email_templates_design_column.sql, then try again.`;
    }

    if (tableName === "companies") {
      return `Supabase is missing the ${tableName}.${columnName} column. Run the SQL in supabase/schema.sql or supabase/fixes/sync_companies_columns.sql, then try again.`;
    }
  }

  return text;
}

async function request(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${APP_CONFIG.supabase.url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: buildHeaders(options.headers),
    body: options.body
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Your Supabase session is missing or has expired.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      buildFriendlySupabaseError(message || `Supabase request failed with ${response.status}.`)
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const supabaseService = {
  isReady() {
    return isSupabaseConfigured();
  },
  async list(tableName) {
    return request(`${tableName}?select=*`);
  },
  async upsert(tableName, record) {
    const result = await request(`${tableName}?on_conflict=id`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates, return=representation"
      },
      body: JSON.stringify([record])
    });

    return result?.[0] || null;
  },
  async remove(tableName, id) {
    return request(`${tableName}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal"
      }
    });
  }
};
