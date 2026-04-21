import { DEFAULT_CONFIG } from "./default-config.js";

function mergeConfig() {
  const runtimeConfig = window.RUNTIME_CONFIG || {};
  const supabase = {
    ...DEFAULT_CONFIG.supabase,
    ...(runtimeConfig.supabase || {})
  };

  return {
    ...DEFAULT_CONFIG,
    ...runtimeConfig,
    brand: {
      ...DEFAULT_CONFIG.brand,
      ...(runtimeConfig.brand || {})
    },
    supabase
  };
}

export const APP_CONFIG = mergeConfig();

export function isSupabaseConfigured() {
  return Boolean(APP_CONFIG.supabase.url && APP_CONFIG.supabase.anonKey);
}
