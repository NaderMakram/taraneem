const fs = require("fs");
const path = require("path");

const SETTINGS_VERSION = 1;
const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  enabled: false,
  port: 17841,
  canvas: { width: 1920, height: 1080 },
  textArea: { x: 96, y: 820, width: 1728, height: 200 },
  song: { maxLines: 2, font: "times", fontSize: 52, minFontSize: 36, fontWeight: 700, align: "center" },
  bible: { maxLines: 1, font: "times", fontSize: 52, minFontSize: 36, fontWeight: 700, align: "right" },
  appearance: {
    preset: "rounded",
    textColor: "#ffffff",
    bannerColor: "#07111f",
    bannerOpacity: 0.88,
    padding: 28,
    radius: 22,
    shadow: true,
  },
  reference: {
    show: true,
    position: "above",
    fontSize: 30,
    color: "#dbeafe",
    align: "right",
    x: 96,
    y: 748,
    width: 1728,
    height: 56,
  },
  previewBounds: null,
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const isFiniteInteger = (value) => Number.isSafeInteger(value);
const inRange = (value, min, max) => isFiniteInteger(value) && value >= min && value <= max;
const isColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const FONT_IDS = new Set(["times", "traditional", "plex", "din", "adobe"]);

function validateRect(rect, canvas, label) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(isFiniteInteger)) {
    throw new Error(`${label}: أدخل أبعادًا صحيحة`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 ||
      rect.x + rect.width > canvas.width || rect.y + rect.height > canvas.height) {
    throw new Error(`${label}: يجب أن تبقى المساحة داخل لوحة العرض`);
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function validateTypography(value, { bible = false } = {}) {
  const maxLines = bible ? 1 : value?.maxLines;
  if ((!bible && ![1, 2].includes(maxLines)) ||
      !inRange(value?.fontSize, 24, 120) ||
      !inRange(value?.minFontSize, 20, value.fontSize) ||
      !inRange(value?.fontWeight, 400, 900) ||
      !["right", "center"].includes(value?.align) || !FONT_IDS.has(value?.font)) {
    throw new Error("إعدادات حجم أو محاذاة النص غير صالحة");
  }
  return { maxLines, font: value.font, fontSize: value.fontSize, minFontSize: value.minFontSize,
    fontWeight: value.fontWeight, align: value.align };
}

function validateSettings(input) {
  const value = { ...clone(DEFAULT_SETTINGS), ...clone(input || {}) };
  value.canvas = { ...DEFAULT_SETTINGS.canvas, ...(input?.canvas || {}) };
  value.textArea = { ...DEFAULT_SETTINGS.textArea, ...(input?.textArea || {}) };
  value.song = { ...DEFAULT_SETTINGS.song, ...(input?.song || {}) };
  value.bible = { ...DEFAULT_SETTINGS.bible, ...(input?.bible || {}) };
  value.appearance = { ...DEFAULT_SETTINGS.appearance, ...(input?.appearance || {}) };
  value.reference = { ...DEFAULT_SETTINGS.reference, ...(input?.reference || {}) };

  if (typeof value.enabled !== "boolean") throw new Error("حالة البث غير صالحة");
  if (!inRange(value.port, 1024, 65535)) throw new Error("المنفذ يجب أن يكون بين 1024 و65535");
  if (!inRange(value.canvas.width, 640, 3840) || !inRange(value.canvas.height, 360, 2160)) {
    throw new Error("أبعاد اللوحة يجب أن تكون بين 640×360 و3840×2160");
  }
  value.textArea = validateRect(value.textArea, value.canvas, "مساحة النص");
  value.song = validateTypography(value.song);
  value.bible = validateTypography(value.bible, { bible: true });

  const a = value.appearance;
  if (!["text", "solid", "rounded"].includes(a.preset) || !isColor(a.textColor) ||
      !isColor(a.bannerColor) || typeof a.bannerOpacity !== "number" ||
      a.bannerOpacity < 0 || a.bannerOpacity > 1 || !inRange(a.padding, 0, 80) ||
      !inRange(a.radius, 0, 80) || typeof a.shadow !== "boolean") {
    throw new Error("إعدادات مظهر الشريط غير صالحة");
  }

  const requiredSongHeight = Math.ceil(value.song.maxLines * value.song.fontSize * 1.28 + a.padding * 2);
  const requiredBibleHeight = Math.ceil(value.bible.fontSize * 1.28 + a.padding * 2);
  if (value.textArea.height < Math.max(requiredSongHeight, requiredBibleHeight)) {
    throw new Error("ارتفاع مساحة النص لا يكفي لحجم الخط وعدد السطور");
  }

  const ref = value.reference;
  if (typeof ref.show !== "boolean" || !["above", "inline", "custom"].includes(ref.position) ||
      !inRange(ref.fontSize, 18, 72) || !isColor(ref.color) ||
      !["right", "center"].includes(ref.align)) {
    throw new Error("إعدادات الشاهد غير صالحة");
  }
  const refRect = validateRect(ref, value.canvas, "مساحة الشاهد");
  value.reference = { ...ref, ...refRect };
  if (value.reference.show && value.reference.height < Math.ceil(value.reference.fontSize * 1.25)) {
    throw new Error("ارتفاع مساحة الشاهد لا يكفي لحجم الخط");
  }

  if (value.reference.show && value.reference.position === "above" &&
      value.reference.y + value.reference.height > value.textArea.y) {
    throw new Error("مساحة الشاهد العلوية يجب أن تكون فوق مساحة النص");
  }
  if (value.reference.show && value.reference.position === "inline" &&
      value.reference.width + value.appearance.padding * 3 >= value.textArea.width) {
    throw new Error("مساحة الشاهد الجانبية تترك عرضًا غير كافٍ للنص");
  }

  if (value.previewBounds != null) {
    const b = value.previewBounds;
    if (!b || ![b.x, b.y, b.width, b.height].every(isFiniteInteger) || b.width < 480 || b.height < 270) {
      value.previewBounds = null;
    } else {
      value.previewBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
  }
  value.version = SETTINGS_VERSION;
  return value;
}

function scalePreset(width, height) {
  const sx = width / 1920;
  const sy = height / 1080;
  const scaled = clone(DEFAULT_SETTINGS);
  scaled.canvas = { width, height };
  for (const key of ["textArea", "reference"]) {
    scaled[key].x = Math.round(scaled[key].x * sx);
    scaled[key].y = Math.round(scaled[key].y * sy);
    scaled[key].width = Math.round(scaled[key].width * sx);
    scaled[key].height = Math.round(scaled[key].height * sy);
  }
  for (const key of ["song", "bible"]) {
    scaled[key].fontSize = Math.round(scaled[key].fontSize * sy);
    scaled[key].minFontSize = Math.max(24, Math.round(scaled[key].minFontSize * sy));
  }
  scaled.reference.fontSize = Math.max(18, Math.round(scaled.reference.fontSize * sy));
  scaled.appearance.padding = Math.round(scaled.appearance.padding * sy);
  scaled.appearance.radius = Math.round(scaled.appearance.radius * sy);
  return validateSettings(scaled);
}

function createSettingsStore(userDataPath) {
  const filePath = path.join(userDataPath, "livestream-settings.json");
  function load() {
    try {
      return validateSettings(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch (_error) {
      return clone(DEFAULT_SETTINGS);
    }
  }
  function save(settings) {
    const validated = validateSettings(settings);
    fs.mkdirSync(userDataPath, { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(validated, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
    return validated;
  }
  return { filePath, load, save };
}

module.exports = { DEFAULT_SETTINGS, SETTINGS_VERSION, createSettingsStore, scalePreset, validateSettings };
