const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { DEFAULT_SETTINGS, createSettingsStore, scalePreset, validateSettings } = require("../src/livestream/settingsStore");
const { createLivestreamState } = require("../src/livestream/state");
const { createLivestreamServer } = require("../src/livestream/server");

test("validates defaults, presets, geometry, and port", () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  const compact = scalePreset(1280, 720);
  assert.deepEqual(compact.canvas, { width: 1280, height: 720 });
  assert.ok(compact.reference.y + compact.reference.height <= compact.textArea.y);
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, port: 80 }), /المنفذ/);
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, textArea: { x: 1800, y: 900, width: 500, height: 100 } }), /داخل لوحة/);
});

test("settings persist atomically and corrupt settings fall back", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-live-"));
  const store = createSettingsStore(directory);
  store.save({ ...DEFAULT_SETTINGS, enabled: true, port: 18888 });
  assert.equal(store.load().port, 18888);
  fs.writeFileSync(store.filePath, "{bad", "utf8");
  assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("hide survives selection while clear removes body and reference", () => {
  const state = createLivestreamState({ ...DEFAULT_SETTINGS, enabled: true });
  state.setVisible(false);
  state.publish({ content: { id: "x", kind: "bible", sourceId: "s", parentType: "verse", parentNumber: "1", partIndex: 1, partCount: 1, lines: ["نص"] }, reference: "يوحنا ١:١" });
  assert.equal(state.getSnapshot().visible, false);
  state.clear();
  assert.deepEqual(state.getSnapshot().content.lines, []);
  assert.equal(state.getSnapshot().reference, null);
});

function request(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port, path: pathname, headers }, response => {
      let body = ""; response.setEncoding("utf8");
      response.on("data", chunk => body += chunk);
      response.on("end", () => resolve({ status: response.statusCode, body, headers: response.headers }));
    }).on("error", reject);
  });
}

test("service serves allowlisted assets and rejects malformed paths/hosts", async () => {
  const state = createLivestreamState({ ...DEFAULT_SETTINGS, enabled: true });
  const service = createLivestreamServer({ state });
  const address = await service.start(0);
  try {
    const page = await request(address.port, "/?layer=text", { Host: `127.0.0.1:${address.port}` });
    assert.equal(page.status, 200);
    assert.match(page.headers["content-security-policy"], /default-src 'self'/);
    assert.equal((await request(address.port, "/../../package.json", { Host: `127.0.0.1:${address.port}` })).status, 404);
    assert.equal((await request(address.port, "/", { Host: `example.com:${address.port}` })).status, 403);
  } finally { await service.stop(); }
});

test("new SSE clients receive the full latest snapshot", async () => {
  const state = createLivestreamState({ ...DEFAULT_SETTINGS, enabled: true });
  state.publish({ content: { id: "x", kind: "song", sourceId: "s", parentType: "verse", parentNumber: "1", partIndex: 1, partCount: 1, lines: ["كامل"] } });
  const service = createLivestreamServer({ state });
  const address = await service.start(0);
  try {
    const body = await new Promise((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port: address.port, path: "/events", headers: { Host: `localhost:${address.port}` } }, response => {
        response.setEncoding("utf8");
        response.on("data", chunk => { if (chunk.includes("event: snapshot")) { resolve(chunk); req.destroy(); } });
      });
      req.on("error", error => { if (error.code !== "ECONNRESET") reject(error); });
    });
    assert.match(body, /كامل/);
  } finally { await service.stop(); }
});
