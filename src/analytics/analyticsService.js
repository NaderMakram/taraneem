const crypto = require("crypto");
const deviceStore = require("./deviceStore");
const queueStore = require("./queueStore");
const syncClient = require("./syncClient");
const config = require("./config");
const debug = require("./analyticsDebug");

const state = {
  userDataPath: null,
  deviceId: null,
  sessionId: null,
  sessionStartedAt: null,
  openSegment: null,
  appVersion: null,
  deps: null,
  sessionActive: false,
};

function uuid() {
  return crypto.randomUUID();
}

function buildDevicePayload(device) {
  const { deps } = state;
  return {
    device_id: device.device_id,
    first_seen_at: device.first_seen_at,
    last_seen_at: new Date().toISOString(),
    app_version: state.appVersion,
    platform: process.platform,
    arch: process.arch,
    locale: deps?.getLocale?.() || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    display_count: deps?.getDisplayCount?.() || null,
    country_code: device.country_code,
    region_name: device.region_name,
    city: device.city,
    geo_source: device.geo_source,
    geo_updated_at: device.geo_updated_at,
  };
}

function enqueueDevice() {
  const device = deviceStore.load(state.userDataPath);
  queueStore.enqueue(state.userDataPath, {
    table: "devices",
    op: "upsert",
    payload: buildDevicePayload(device),
  });
}

function setup(deps) {
  state.userDataPath = deps.userDataPath;
  state.appVersion = deps.getAppVersion();
  state.deps = deps;

  const device = deviceStore.load(deps.userDataPath);
  state.deviceId = device.device_id;

  const cfg = config.loadConfig();
  debug.log("info", "Analytics setup", {
    configured: !!cfg,
    supabaseUrl: cfg?.supabaseUrl || "(missing)",
    deviceId: state.deviceId,
    userDataPath: deps.userDataPath,
  });

  syncClient.startPeriodicSync(
    deps.userDataPath,
    () => state.deviceId,
    deps
  );
}

function startSession() {
  if (state.sessionActive) return;

  state.sessionId = uuid();
  state.sessionStartedAt = new Date().toISOString();
  state.sessionActive = true;
  state.openSegment = null;

  enqueueDevice();
  queueStore.enqueue(state.userDataPath, {
    table: "sessions",
    op: "upsert",
    payload: {
      session_id: state.sessionId,
      device_id: state.deviceId,
      started_at: state.sessionStartedAt,
      ended_at: null,
      duration_sec: null,
      app_version: state.appVersion,
    },
  });

  debug.log("info", "Session started", {
    sessionId: state.sessionId,
    deviceId: state.deviceId,
  });

  syncClient.scheduleSync(state.userDataPath, state.deviceId, state.deps);
}

function closeOpenSegment() {
  if (!state.openSegment || !state.sessionActive) return;

  const endedAt = new Date().toISOString();
  const durationMs = Math.max(
    0,
    Date.now() - new Date(state.openSegment.started_at).getTime()
  );

  queueStore.enqueue(state.userDataPath, {
    table: "content_events",
    op: "insert",
    payload: {
      ...state.openSegment,
      ended_at: endedAt,
      duration_ms: durationMs,
    },
  });

  state.openSegment = null;
}

function trackPresentation(meta) {
  if (!state.sessionActive) {
    startSession();
  }

  closeOpenSegment();

  if (!meta || meta.content_type === "blank") {
    syncClient.scheduleSync(state.userDataPath, state.deviceId, state.deps);
    return;
  }

  const now = new Date().toISOString();
  state.openSegment = {
    event_id: uuid(),
    device_id: state.deviceId,
    session_id: state.sessionId,
    content_type: meta.content_type,
    content_ref: meta.content_ref || "unknown",
    title: meta.title || null,
    verse_number: meta.verse_number || null,
    started_at: now,
    app_version: state.appVersion,
  };
}

function endSession() {
  if (!state.sessionActive) return;

  closeOpenSegment();

  const endedAt = new Date().toISOString();
  const durationSec = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(state.sessionStartedAt).getTime()) / 1000
    )
  );

  enqueueDevice();
  queueStore.enqueue(state.userDataPath, {
    table: "sessions",
    op: "upsert",
    payload: {
      session_id: state.sessionId,
      device_id: state.deviceId,
      started_at: state.sessionStartedAt,
      ended_at: endedAt,
      duration_sec: durationSec,
      app_version: state.appVersion,
    },
  });

  state.sessionActive = false;
  return syncClient.trySync(state.userDataPath, state.deviceId, state.deps);
}

function trackLocalSong(action, song) {
  if (!state.userDataPath) return;
  if (!state.sessionActive) {
    startSession();
  }

  const localSongId = song.id != null ? String(song.id) : String(song._index ?? "unknown");

  const payload = {
    event_id: uuid(),
    device_id: state.deviceId,
    local_song_id: localSongId,
    action,
    title: song.title || null,
    chorus_first: song.chorusFirst ?? null,
    has_chorus: Array.isArray(song.chorus) ? song.chorus.length > 0 : !!song.chorus,
    chorus: action === "delete" ? null : song.chorus || null,
    verses: action === "delete" ? null : song.verses || null,
    occurred_at: new Date().toISOString(),
    app_version: state.appVersion,
  };

  queueStore.enqueue(state.userDataPath, {
    table: "local_song_events",
    op: "insert",
    payload,
  });

  syncClient.scheduleSync(state.userDataPath, state.deviceId, state.deps);
}

function forceSync() {
  return syncClient.trySync(state.userDataPath, state.deviceId, state.deps);
}

function getDebugStatus() {
  const pending = state.userDataPath
    ? queueStore.getPending(state.userDataPath)
    : [];
  return {
    configured: config.isConfigured(),
    supabaseUrl: config.loadConfig()?.supabaseUrl,
    deviceId: state.deviceId,
    sessionId: state.sessionId,
    sessionActive: state.sessionActive,
    pendingCount: pending.length,
    openSegment: !!state.openSegment,
  };
}

module.exports = {
  setup,
  startSession,
  endSession,
  trackPresentation,
  trackLocalSong,
  forceSync,
  getDebugStatus,
};
