const https = require("https");
const { net } = require("electron");
const config = require("./config");
const deviceStore = require("./deviceStore");
const queueStore = require("./queueStore");
const debug = require("./analyticsDebug");
const { getSupabaseGlobals } = require("./polyfillFetch");

const SCHEMA = "taraneem_analytics";
const GEO_URL = "https://ipapi.co/json/";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let supabaseClient = null;
let supabaseClientUrl = null;
let syncInProgress = false;
let lastSyncAttempt = 0;

function getClient() {
  const cfg = config.loadConfig();
  if (!cfg) return null;

  if (supabaseClient && supabaseClientUrl !== cfg.supabaseUrl) {
    supabaseClient = null;
  }
  if (supabaseClient) return supabaseClient;

  try {
    const globals = getSupabaseGlobals();
    // #region agent log
    fetch("http://127.0.0.1:7290/ingest/6bc0553c-ef11-4be7-9d24-dc444a27fa13", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "acfb18",
      },
      body: JSON.stringify({
        sessionId: "acfb18",
        hypothesisId: "H2",
        location: "syncClient.js:getClient",
        message: "globals before createClient",
        data: {
          electronNode: process.versions.node,
          hasFetch: !!globals.fetch,
          hasWebSocket: !!globals.WebSocket,
          wsPolyfill: globals.wsPolyfill,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const { createClient } = require("@supabase/supabase-js");
    debug.log("info", "Creating Supabase client", {
      url: cfg.supabaseUrl,
      schema: SCHEMA,
      electronNode: process.versions.node,
      wsPolyfill: globals.wsPolyfill?.applied,
    });
    supabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      db: { schema: SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: globals.fetch,
        Headers: globals.Headers,
        WebSocket: globals.WebSocket,
      },
    });
    supabaseClientUrl = cfg.supabaseUrl;

    // #region agent log
    fetch("http://127.0.0.1:7290/ingest/6bc0553c-ef11-4be7-9d24-dc444a27fa13", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "acfb18",
      },
      body: JSON.stringify({
        sessionId: "acfb18",
        hypothesisId: "H1",
        location: "syncClient.js:getClient",
        message: "createClient success",
        data: { ok: true },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return supabaseClient;
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7290/ingest/6bc0553c-ef11-4be7-9d24-dc444a27fa13", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "acfb18",
      },
      body: JSON.stringify({
        sessionId: "acfb18",
        hypothesisId: "H1",
        location: "syncClient.js:getClient",
        message: "createClient failed",
        data: { error: e.message, stack: e.stack?.slice(0, 200) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    debug.log("error", "Supabase client init failed", e.message);
    return null;
  }
}

function httpsGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "Taraneem" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("geo request timeout"));
    });
  });
}

async function refreshGeoIfNeeded(userDataPath) {
  const device = deviceStore.load(userDataPath);
  if (!deviceStore.shouldRefreshGeo(device)) {
    return device;
  }
  if (!net.isOnline()) return device;

  try {
    const geo = await httpsGetJson(GEO_URL);
    return deviceStore.updateGeo(userDataPath, {
      country_code: geo.country_code || geo.country || null,
      region_name: geo.region || geo.regionName || null,
      city: geo.city || null,
      geo_source: "ipapi.co",
      geo_updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[analytics] Geo lookup failed:", e.message);
    return device;
  }
}

function latestByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item.payload);
    map.set(key, item);
  }
  return [...map.values()];
}

/**
 * Resolve session rows to upsert before content_events (FK).
 * Uses full outbox (including already-synced session entries), not only pending.
 */
function buildSessionPayloadsForSync(
  userDataPath,
  pendingSessionItems,
  contentItems
) {
  const neededIds = new Set();
  for (const item of pendingSessionItems) {
    if (item.payload?.session_id) neededIds.add(item.payload.session_id);
  }
  for (const item of contentItems) {
    if (item.payload?.session_id) neededIds.add(item.payload.session_id);
  }
  if (neededIds.size === 0) return [];

  const allSessionItems = queueStore
    .read(userDataPath)
    .pending.filter((i) => i.table === "sessions");

  const latest = latestByKey(allSessionItems, (p) => p.session_id);
  const byId = new Map(latest.map((i) => [i.payload.session_id, i.payload]));

  for (const item of contentItems) {
    const sid = item.payload?.session_id;
    if (!sid || byId.has(sid)) continue;
    byId.set(sid, {
      session_id: sid,
      device_id: item.payload.device_id,
      started_at: item.payload.started_at,
      ended_at: null,
      duration_sec: null,
      app_version: item.payload.app_version ?? null,
    });
    debug.log("warn", "Synthesized session row for content_events FK", {
      session_id: sid,
    });
  }

  const payloads = [];
  for (const id of neededIds) {
    const row = byId.get(id);
    if (row) payloads.push(row);
    else {
      debug.log("warn", "Missing session payload for pending content", {
        session_id: id,
      });
    }
  }
  return payloads;
}

async function trySync(userDataPath, deviceId, deps = {}) {
  debug.log("info", "Sync attempt started", { deviceId });

  if (!config.isConfigured()) {
    debug.log("warn", "Sync skipped: not_configured (check analytics.json)");
    return { ok: false, reason: "not_configured" };
  }
  if (!net.isOnline()) {
    debug.log("warn", "Sync skipped: offline");
    return { ok: false, reason: "offline" };
  }
  if (syncInProgress) {
    debug.log("info", "Sync skipped: already in progress");
    return { ok: false, reason: "in_progress" };
  }

  const client = getClient();
  if (!client) {
    debug.log("error", "Sync skipped: no_client");
    return { ok: false, reason: "no_client" };
  }

  syncInProgress = true;
  const syncedIds = [];

  try {
    await refreshGeoIfNeeded(userDataPath);

    const pending = queueStore.getPending(userDataPath);
    debug.log("info", "Outbox pending count", pending.length);

    if (pending.length === 0) {
      debug.log("info", "Nothing to sync");
      return { ok: true, synced: 0 };
    }

    const deviceItems = pending.filter((i) => i.table === "devices");
    const sessionItems = pending.filter((i) => i.table === "sessions");
    const contentItems = pending.filter((i) => i.table === "content_events");
    const localSongItems = pending.filter(
      (i) => i.table === "local_song_events"
    );

    debug.log("info", "Outbox breakdown", {
      devices: deviceItems.length,
      sessions: sessionItems.length,
      content_events: contentItems.length,
      local_song_events: localSongItems.length,
    });

    const latestDevice = latestByKey(deviceItems, (p) => p.device_id)[0];
    if (latestDevice) {
      debug.log("info", "Upserting device", latestDevice.payload.device_id);
      const { error } = await client
        .from("devices")
        .upsert(latestDevice.payload, {
          onConflict: "device_id",
        });
      if (error) throw error;
      debug.log("info", "Device upsert OK");
      syncedIds.push(latestDevice.queue_id);
      deviceItems.forEach((i) => {
        if (i.queue_id !== latestDevice.queue_id) syncedIds.push(i.queue_id);
      });
    }

    const sessionPayloads = buildSessionPayloadsForSync(
      userDataPath,
      sessionItems,
      contentItems
    );
    if (sessionPayloads.length > 0) {
      debug.log("info", "Upserting sessions", sessionPayloads.length);
      const { error } = await client.from("sessions").upsert(sessionPayloads, {
        onConflict: "session_id",
      });
      if (error) throw error;
      debug.log("info", "Sessions upsert OK");
      sessionItems.forEach((i) => syncedIds.push(i.queue_id));
    }

    if (contentItems.length > 0) {
      debug.log("info", "Inserting content_events", contentItems.length);
      const rows = contentItems.map((i) => i.payload);
      const { error } = await client.from("content_events").upsert(rows, {
        onConflict: "event_id",
        ignoreDuplicates: true,
      });
      if (error) throw error;
      debug.log("info", "content_events OK");
      contentItems.forEach((i) => syncedIds.push(i.queue_id));
    }

    if (localSongItems.length > 0) {
      debug.log("info", "Inserting local_song_events", localSongItems.length);
      const rows = localSongItems.map((i) => i.payload);
      const { error } = await client.from("local_song_events").upsert(rows, {
        onConflict: "event_id",
        ignoreDuplicates: true,
      });
      if (error) throw error;
      debug.log("info", "local_song_events OK");
      localSongItems.forEach((i) => syncedIds.push(i.queue_id));
    }

    if (syncedIds.length > 0) {
      queueStore.markSynced(userDataPath, syncedIds);
    }

    debug.log("info", "Sync completed", { rowsMarkedSynced: syncedIds.length });
    // #region agent log
    fetch("http://127.0.0.1:7290/ingest/6bc0553c-ef11-4be7-9d24-dc444a27fa13", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "acfb18",
      },
      body: JSON.stringify({
        sessionId: "acfb18",
        hypothesisId: "H4",
        location: "syncClient.js:trySync",
        message: "sync completed",
        data: { synced: syncedIds.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return { ok: true, synced: syncedIds.length };
  } catch (e) {
    const detail = debug.formatSupabaseError(e);
    // #region agent log
    fetch("http://127.0.0.1:7290/ingest/6bc0553c-ef11-4be7-9d24-dc444a27fa13", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "acfb18",
      },
      body: JSON.stringify({
        sessionId: "acfb18",
        hypothesisId: "H4",
        location: "syncClient.js:trySync",
        message: "sync failed",
        data: {
          detail,
          code: e?.code,
          table: e?.message?.includes("devices") ? "devices" : undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    debug.log("error", "Sync failed", detail);
    return { ok: false, reason: "error", error: e, detail };
  } finally {
    syncInProgress = false;
    lastSyncAttempt = Date.now();
  }
}

function scheduleSync(userDataPath, deviceId, deps) {
  const now = Date.now();
  if (now - lastSyncAttempt < 5000) return;
  trySync(userDataPath, deviceId, deps).catch(() => {});
}

function startPeriodicSync(userDataPath, getDeviceId, deps) {
  setInterval(() => {
    scheduleSync(userDataPath, getDeviceId(), deps);
  }, SYNC_INTERVAL_MS);
}

module.exports = {
  trySync,
  scheduleSync,
  startPeriodicSync,
  refreshGeoIfNeeded,
};
