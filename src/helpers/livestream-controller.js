import { prepareParts } from "../livestream/chunking.mjs";

let status = { mode: false, visible: true, running: false, clientCount: 0, url: "", error: null, settings: null };
let fontsReady = false;
let rebuildCurrentPreview = null;
let lastValidationError = null;
const partByElement = new WeakMap();
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");

function emitStatus() {
  window.dispatchEvent(new CustomEvent("livestream-status", { detail: getLivestreamStatus() }));
}

export function renderLivestreamValidationError() {
  if (!lastValidationError) return;
  let alert = document.getElementById("livestream-preview-error");
  if (!alert) { alert = document.createElement("p"); alert.id = "livestream-preview-error"; alert.className = "livestream-message"; alert.dataset.error = "true"; alert.setAttribute("role", "alert"); document.getElementById("preview_output")?.prepend(alert); }
  alert.textContent = lastValidationError;
}

function reportValidationError(error) {
  lastValidationError = error.message || String(error);
  renderLivestreamValidationError();
  window.dispatchEvent(new CustomEvent("livestream-validation-error", { detail: lastValidationError }));
}

function measure(text, size, weight, font = "times") {
  const families = { times: "MyTimesNewRoman", traditional: "traditional-arabic", plex: "ibm-plex", din: "din-next", adobe: "adobe-arabic" };
  context.font = `${weight} ${size}px ${families[font] || families.times}, serif`;
  return context.measureText(text).width;
}

export function getLivestreamStatus() {
  return JSON.parse(JSON.stringify(status));
}

export function isLivestreamMode() {
  return Boolean(status.mode && status.settings?.enabled);
}

export function getLivestreamSettings() {
  return status.settings;
}

export function registerLivestreamRebuild(handler) {
  rebuildCurrentPreview = handler;
}

export function beginLivestreamPreparation() {
  lastValidationError = null;
  document.getElementById("livestream-preview-error")?.remove();
}

export function createLivestreamParts(source) {
  if (!isLivestreamMode()) return [];
  try {
    if (!fontsReady) throw new Error("خط العرض لم يجهز بعد");
    const settings = status.settings;
  const typography = source.kind === "bible" || source.kind === "heading" ? settings.bible : settings.song;
  if (source.reference && settings.reference.show) {
    const referenceWidth = measure(source.reference, settings.reference.fontSize, 700, typography.font);
    if (referenceWidth > settings.reference.width - 24) {
      const error = new Error(`الشاهد «${source.reference}» أعرض من مساحة الشاهد. وسّعها أو صغّر خط الشاهد`);
      throw error;
    }
  }
  let maxWidth = settings.textArea.width - settings.appearance.padding * 2;
  if (settings.reference.show && settings.reference.position === "inline") {
    maxWidth -= settings.reference.width + settings.appearance.padding;
  }
    return prepareParts({
      ...source,
    options: {
      measure: (text, size, weight) => measure(text, size, weight, typography.font),
      maxWidth,
      maxLines: typography.maxLines,
      fontSize: typography.fontSize,
      minFontSize: typography.minFontSize,
      fontWeight: typography.fontWeight,
      },
    });
  } catch (error) {
    reportValidationError(error);
    window.myCustomAPI.livestream.clear();
    throw error;
  }
}

export function attachLivestreamPart(element, part) {
  partByElement.set(element, part);
  element.dataset.livePart = "true";
  element.dataset.sourceId = part.sourceId;
  element.dataset.sourceStart = String(part.sourceStart);
  element.dataset.sourceEnd = String(part.sourceEnd);
  element.dataset.parentType = part.parentType;
  element.dataset.parentNumber = part.parentNumber ?? "";
  element.dataset.partIndex = String(part.partIndex);
  element.dataset.partCount = String(part.partCount);
  if (part.partCount > 1) {
    const label = document.createElement("span");
    label.className = "livestream-part-label";
    label.textContent = `جزء ${new Intl.NumberFormat("ar-EG").format(part.partIndex)} من ${new Intl.NumberFormat("ar-EG").format(part.partCount)}`;
    element.appendChild(label);
  }
}

export function publishCurrentLivestreamSlide() {
  if (!isLivestreamMode()) return false;
  const element = document.querySelector("#preview_output .slide.active");
  const part = element && partByElement.get(element);
  if (!part) {
    window.myCustomAPI.livestream.clear();
    return true;
  }
  window.myCustomAPI.livestream.publish({
    content: {
      id: part.id,
      kind: part.kind,
      sourceId: part.sourceId,
      parentType: part.parentType,
      parentNumber: part.parentNumber,
      partIndex: part.partIndex,
      partCount: part.partCount,
      lines: part.lines,
      fontSize: part.fontSize,
    },
    reference: part.reference,
  });
  return true;
}

export function clearLivestreamOutput() {
  if (isLivestreamMode()) window.myCustomAPI.livestream.clear();
}

export async function applyLivestreamSettings(settings) {
  const active = document.querySelector("#preview_output .slide.active");
  const position = active ? {
    sourceId: active.dataset.sourceId,
    parentType: active.dataset.parentType,
    parentNumber: active.dataset.parentNumber,
    sourceStart: Number(active.dataset.sourceStart || 0),
  } : null;
  const previousMode = status.mode;
  const next = await window.myCustomAPI.livestream.applySettings(settings);
  status = { ...status, ...next };
  if (rebuildCurrentPreview) {
    try { rebuildCurrentPreview(previousMode === status.mode ? position : null); }
    catch (error) { reportValidationError(error); window.myCustomAPI.livestream.clear(); }
  }
  emitStatus();
  return getLivestreamStatus();
}

export function getLivestreamValidationError() { return lastValidationError; }

export function measureLivestreamText(text, kind = "song") {
  const typography = kind === "bible" ? status.settings.bible : status.settings.song;
  return { width: measure(text, typography.fontSize, typography.fontWeight, typography.font), font: typography.font, size: typography.fontSize, weight: typography.fontWeight };
}

export async function initializeLivestreamController() {
  const update = next => { status = { ...status, ...next }; emitStatus(); };
  window.myCustomAPI.livestream.onStatus(update);
  status = await window.myCustomAPI.livestream.getStatus();
  await document.fonts.ready;
  const families = ["MyTimesNewRoman", "traditional-arabic", "ibm-plex", "din-next", "adobe-arabic"];
  await Promise.all(families.map(family => document.fonts.load(`700 52px ${family}`)));
  fontsReady = true;
  emitStatus();
  return status;
}
