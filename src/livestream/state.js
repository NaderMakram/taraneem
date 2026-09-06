const { DEFAULT_SETTINGS, validateSettings } = require("./settingsStore");
const crypto = require("crypto");

const clone = (value) => JSON.parse(JSON.stringify(value));
const EMPTY_CONTENT = Object.freeze({
  id: null,
  kind: null,
  sourceId: null,
  parentType: null,
  parentNumber: null,
  partIndex: 0,
  partCount: 0,
  lines: [],
  fontSize: null,
});

function sanitizeContent(content) {
  if (!content || !Array.isArray(content.lines) || content.lines.length === 0) return clone(EMPTY_CONTENT);
  if (content.lines.length > 2 || content.lines.some(line => typeof line !== "string" || line.length > 4000)) {
    throw new Error("محتوى البث غير صالح");
  }
  const allowedKinds = new Set(["song", "bible", "heading"]);
  if (!allowedKinds.has(content.kind)) throw new Error("نوع محتوى البث غير صالح");
  return {
    id: String(content.id || "").slice(0, 200),
    kind: content.kind,
    sourceId: String(content.sourceId || "").slice(0, 200),
    parentType: String(content.parentType || "").slice(0, 30),
    parentNumber: content.parentNumber == null ? null : String(content.parentNumber).slice(0, 20),
    partIndex: Number.isSafeInteger(content.partIndex) ? content.partIndex : 0,
    partCount: Number.isSafeInteger(content.partCount) ? content.partCount : 1,
    lines: content.lines.map(line => line.slice(0, 4000)),
    fontSize: Number.isFinite(content.fontSize) ? Math.max(20, Math.min(120, content.fontSize)) : null,
  };
}

function createLivestreamState(initialSettings = DEFAULT_SETTINGS) {
  let snapshot = {
    epoch: crypto.randomBytes(12).toString("hex"),
    mode: Boolean(initialSettings.enabled),
    visible: true,
    content: clone(EMPTY_CONTENT),
    reference: null,
    settings: validateSettings(initialSettings),
    revision: 0,
  };
  const listeners = new Set();
  const emit = () => {
    const value = clone(snapshot);
    for (const listener of listeners) listener(value);
    return value;
  };
  const mutate = (change) => {
    snapshot = { ...snapshot, ...change, revision: snapshot.revision + 1 };
    return emit();
  };
  return {
    getSnapshot: () => clone(snapshot),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setMode(mode) { return mutate({ mode: Boolean(mode), visible: true, content: clone(EMPTY_CONTENT), reference: null }); },
    setVisible(visible) { return mutate({ visible: Boolean(visible) }); },
    clear() { return mutate({ content: clone(EMPTY_CONTENT), reference: null }); },
    publish(payload) {
      const content = sanitizeContent(payload?.content);
      const reference = content.lines.length && typeof payload?.reference === "string"
        ? payload.reference.slice(0, 500) : null;
      return mutate({ content, reference });
    },
    setSettings(settings) {
      const validated = validateSettings(settings);
      return mutate({ settings: validated, mode: validated.enabled, content: clone(EMPTY_CONTENT), reference: null });
    },
  };
}

module.exports = { EMPTY_CONTENT, createLivestreamState, sanitizeContent };
