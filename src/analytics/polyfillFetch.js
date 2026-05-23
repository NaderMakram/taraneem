/**
 * Electron 22 main process uses embedded Node 16 — not your system Node version.
 * Supabase JS 2.x needs fetch/Headers and WebSocket (ws package on Node < 22).
 */
function ensureFetchGlobals() {
  const hadHeaders = typeof globalThis.Headers !== "undefined";
  const hadFetch = typeof globalThis.fetch !== "undefined";
  let fetchApplied = false;

  if (!hadHeaders || !hadFetch) {
    const undici = require("undici");
    if (typeof globalThis.Headers === "undefined") {
      globalThis.Headers = undici.Headers;
    }
    if (typeof globalThis.Request === "undefined") {
      globalThis.Request = undici.Request;
    }
    if (typeof globalThis.Response === "undefined") {
      globalThis.Response = undici.Response;
    }
    if (typeof globalThis.fetch === "undefined") {
      globalThis.fetch = undici.fetch;
    }
    fetchApplied = true;
  }

  return {
    fetchApplied,
    hasHeaders: typeof globalThis.Headers !== "undefined",
    hasFetch: typeof globalThis.fetch !== "undefined",
    electronNode: process.versions.node,
  };
}

function ensureWebSocket() {
  if (typeof globalThis.WebSocket !== "undefined") {
    return { applied: false, hasWebSocket: true };
  }
  const WebSocketImpl = require("ws");
  globalThis.WebSocket = WebSocketImpl;
  return { applied: true, hasWebSocket: true, electronNode: process.versions.node };
}

function getSupabaseGlobals() {
  ensureFetchGlobals();
  const ws = ensureWebSocket();
  return {
    fetch: globalThis.fetch,
    Headers: globalThis.Headers,
    WebSocket: globalThis.WebSocket,
    wsPolyfill: ws,
  };
}

module.exports = { ensureFetchGlobals, ensureWebSocket, getSupabaseGlobals };
