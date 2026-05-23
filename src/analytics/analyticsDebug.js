const isDev = require("electron-is-dev");

// Temporary: set false to silence renderer console logs (main process logs stay on)
const DEBUG_RENDERER = true;

let mainWindow = null;

function setMainWindow(win) {
  mainWindow = win;
}

function log(level, message, data) {
  const prefix = `[analytics] ${message}`;
  const payload = data !== undefined ? data : "";

  if (level === "error") {
    console.error(prefix, payload);
  } else if (level === "warn") {
    console.warn(prefix, payload);
  } else {
    console.log(prefix, payload);
  }

  if (!DEBUG_RENDERER || !mainWindow || mainWindow.isDestroyed()) return;

  try {
    mainWindow.webContents.send("analytics:debug", {
      level,
      message,
      data: payload,
      at: new Date().toISOString(),
    });
  } catch (_) {
    // window may be closing
  }
}

function formatSupabaseError(error) {
  if (!error) return "unknown error";

  if (error.code === "PGRST106") {
    return (
      "Supabase API does not expose schema 'taraneem_analytics'. " +
      "In Supabase Dashboard: Project Settings → API → Exposed schemas → " +
      "add taraneem_analytics (keep public), then Save. " +
      `Original: ${error.message}`
    );
  }

  if (error.code === "42501") {
    return (
      "Database denied insert/update for anon role. " +
      "In Supabase SQL Editor, run: supabase/fix_anon_permissions.sql " +
      `(then restart the app). Original: ${error.message}`
    );
  }

  if (error.code === "23503") {
    return (
      "Foreign key violation (parent row missing in Supabase). " +
      "Restart the app so sync can re-upsert sessions before content_events. " +
      `Original: ${error.message}`
    );
  }

  const parts = [error.message, error.code, error.details, error.hint].filter(
    Boolean
  );
  return parts.join(" | ") || String(error);
}

module.exports = {
  setMainWindow,
  log,
  formatSupabaseError,
  isDebugEnabled: () => DEBUG_RENDERER || isDev,
};
