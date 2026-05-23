const fs = require("fs");
const path = require("path");

let cached = null;

/** Supabase JS expects project root URL only (no /rest/v1). */
function normalizeSupabaseUrl(url) {
  if (!url || typeof url !== "string") return url;
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function normalizeConfig(raw) {
  if (!raw?.supabaseUrl || !raw?.supabaseAnonKey) return null;
  return {
    supabaseUrl: normalizeSupabaseUrl(raw.supabaseUrl),
    supabaseAnonKey: raw.supabaseAnonKey.trim(),
  };
}

function loadConfigFromFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return normalizeConfig(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch (e) {
    console.error(`[analytics] Invalid ${path.basename(filePath)}`, e);
    return null;
  }
}

function loadConfig() {
  if (cached) return cached;

  const fromEnv = normalizeConfig({
    supabaseUrl: process.env.SUPABASE_URL || process.env.TARANEEM_SUPABASE_URL,
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY || process.env.TARANEEM_SUPABASE_ANON_KEY,
  });

  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  const configDir = path.join(__dirname, "..", "config");
  // Local override (gitignored) → shipped default (every installer)
  const fileCandidates = [
    path.join(configDir, "analytics.json"),
    path.join(configDir, "analytics.bundled.json"),
  ];

  for (const filePath of fileCandidates) {
    const file = loadConfigFromFile(filePath);
    if (file) {
      cached = file;
      return cached;
    }
  }

  cached = null;
  return null;
}

function isConfigured() {
  const cfg = loadConfig();
  return !!(cfg && cfg.supabaseUrl && cfg.supabaseAnonKey);
}

module.exports = { loadConfig, isConfigured };
