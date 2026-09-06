import { applyLivestreamSettings, getLivestreamStatus } from "./livestream-controller.js";

const form = document.getElementById("livestream-form");
const statusText = document.getElementById("livestream-service-status");
const urlInput = document.getElementById("livestream-url");
const message = document.getElementById("livestream-message");

const fields = {
  enabled: "livestream-enabled", port: "livestream-port", canvasWidth: "livestream-canvas-width", canvasHeight: "livestream-canvas-height",
  x: "livestream-x", y: "livestream-y", width: "livestream-width", height: "livestream-height",
  songLines: "livestream-song-lines", songSize: "livestream-song-size", songMinSize: "livestream-song-min-size", songFont: "livestream-song-font", songWeight: "livestream-song-weight", songAlign: "livestream-song-align",
  bibleSize: "livestream-bible-size", bibleMinSize: "livestream-bible-min-size", bibleFont: "livestream-bible-font", bibleWeight: "livestream-bible-weight", bibleAlign: "livestream-bible-align", preset: "livestream-banner-preset", textColor: "livestream-text-color",
  bannerColor: "livestream-banner-color", bannerOpacity: "livestream-banner-opacity", padding: "livestream-padding", radius: "livestream-radius",
  referenceShow: "livestream-reference-show", referencePosition: "livestream-reference-position", referenceAlign: "livestream-reference-align", referenceSize: "livestream-reference-size",
  referenceColor: "livestream-reference-color", referenceX: "livestream-reference-x", referenceY: "livestream-reference-y",
  referenceWidth: "livestream-reference-width", referenceHeight: "livestream-reference-height",
};
const element = key => document.getElementById(fields[key]);
const number = key => Number(element(key).value);

function showMessage(text, error = false) {
  message.textContent = text;
  message.hidden = !text;
  message.dataset.error = String(error);
}

function fill(settings) {
  element("enabled").checked = settings.enabled;
  element("port").value = settings.port;
  element("canvasWidth").value = settings.canvas.width;
  element("canvasHeight").value = settings.canvas.height;
  for (const key of ["x", "y", "width", "height"]) element(key).value = settings.textArea[key];
  element("songLines").value = settings.song.maxLines;
  for (const type of ["song", "bible"]) {
    const cap = type[0].toUpperCase() + type.slice(1);
    element(`${type}Size`).value = settings[type].fontSize;
    element(`${type}MinSize`).value = settings[type].minFontSize;
    element(`${type}Font`).value = settings[type].font;
    element(`${type}Weight`).value = settings[type].fontWeight;
    element(`${type}Align`).value = settings[type].align;
  }
  element("preset").value = settings.appearance.preset;
  element("textColor").value = settings.appearance.textColor;
  element("bannerColor").value = settings.appearance.bannerColor;
  element("bannerOpacity").value = settings.appearance.bannerOpacity;
  document.getElementById("livestream-shadow").checked = settings.appearance.shadow;
  element("padding").value = settings.appearance.padding;
  element("radius").value = settings.appearance.radius;
  element("referenceShow").checked = settings.reference.show;
  element("referencePosition").value = settings.reference.position;
  element("referenceAlign").value = settings.reference.align;
  element("referenceSize").value = settings.reference.fontSize;
  element("referenceColor").value = settings.reference.color;
  for (const key of ["referenceX", "referenceY", "referenceWidth", "referenceHeight"]) {
    const name = key.replace("reference", "").toLowerCase(); element(key).value = settings.reference[name];
  }
  updateSample();
}

function collect() {
  const current = getLivestreamStatus().settings;
  return {
    ...current,
    enabled: element("enabled").checked,
    port: number("port"),
    canvas: { width: number("canvasWidth"), height: number("canvasHeight") },
    textArea: { x: number("x"), y: number("y"), width: number("width"), height: number("height") },
    song: { ...current.song, maxLines: number("songLines"), fontSize: number("songSize"), minFontSize: number("songMinSize"), font: element("songFont").value, fontWeight: number("songWeight"), align: element("songAlign").value },
    bible: { ...current.bible, fontSize: number("bibleSize"), minFontSize: number("bibleMinSize"), font: element("bibleFont").value, fontWeight: number("bibleWeight"), align: element("bibleAlign").value },
    appearance: { ...current.appearance, preset: element("preset").value, textColor: element("textColor").value,
      bannerColor: element("bannerColor").value, bannerOpacity: number("bannerOpacity"), shadow: document.getElementById("livestream-shadow").checked, padding: number("padding"), radius: number("radius") },
    reference: { ...current.reference, show: element("referenceShow").checked, position: element("referencePosition").value, align: element("referenceAlign").value,
      fontSize: number("referenceSize"), color: element("referenceColor").value, x: number("referenceX"), y: number("referenceY"),
      width: number("referenceWidth"), height: number("referenceHeight") },
  };
}

const DEFAULT_FORM_SETTINGS = {
  enabled: false, port: 17841, canvas: { width: 1920, height: 1080 }, textArea: { x: 96, y: 820, width: 1728, height: 200 },
  song: { maxLines: 2, font: "times", fontSize: 52, minFontSize: 36, fontWeight: 700, align: "center" },
  bible: { maxLines: 1, font: "times", fontSize: 52, minFontSize: 36, fontWeight: 700, align: "right" },
  appearance: { preset: "rounded", textColor: "#ffffff", bannerColor: "#07111f", bannerOpacity: .88, padding: 28, radius: 22, shadow: true },
  reference: { show: true, position: "above", fontSize: 30, color: "#dbeafe", align: "right", x: 96, y: 748, width: 1728, height: 56 }, previewBounds: null,
};

function updateSample() {
  const sample = document.getElementById("livestream-sample-text");
  const reference = document.getElementById("livestream-sample-reference");
  if (!sample || !reference) return;
  const fonts = { times: "MyTimesNewRoman", traditional: "traditional-arabic", plex: "ibm-plex", din: "din-next", adobe: "adobe-arabic" };
  sample.style.fontFamily = fonts[element("songFont").value] || fonts.times;
  sample.style.fontWeight = element("songWeight").value;
  sample.style.textAlign = element("songAlign").value;
  sample.style.color = element("textColor").value;
  reference.style.color = element("referenceColor").value;
  reference.style.textAlign = element("referenceAlign").value;
  reference.hidden = !element("referenceShow").checked;
  const container = sample.parentElement;
  container.style.background = element("preset").value === "text" ? "transparent" : element("bannerColor").value;
  container.style.border = element("preset").value === "text" ? "1px dashed #8ca0be" : "0";
  container.style.borderRadius = element("preset").value === "solid" ? "0" : element("radius").value + "px";
}

function applyCanvasPreset(width, height) {
  const sx = width / DEFAULT_FORM_SETTINGS.canvas.width;
  const sy = height / DEFAULT_FORM_SETTINGS.canvas.height;
  const scaled = JSON.parse(JSON.stringify(DEFAULT_FORM_SETTINGS));
  scaled.canvas = { width, height };
  for (const key of ["textArea", "reference"]) {
    for (const dimension of ["x", "width"]) scaled[key][dimension] = Math.round(scaled[key][dimension] * sx);
    for (const dimension of ["y", "height"]) scaled[key][dimension] = Math.round(scaled[key][dimension] * sy);
  }
  for (const type of ["song", "bible"]) {
    scaled[type].fontSize = Math.round(scaled[type].fontSize * sy);
    scaled[type].minFontSize = Math.max(24, Math.round(scaled[type].minFontSize * sy));
  }
  scaled.reference.fontSize = Math.max(18, Math.round(scaled.reference.fontSize * sy));
  scaled.appearance.padding = Math.round(scaled.appearance.padding * sy);
  scaled.appearance.radius = Math.round(scaled.appearance.radius * sy);
  const current = collect();
  fill({
    ...current,
    canvas: scaled.canvas,
    textArea: scaled.textArea,
    song: { ...current.song, ...scaled.song, font: current.song.font, fontWeight: current.song.fontWeight, align: current.song.align },
    bible: { ...current.bible, ...scaled.bible, font: current.bible.font, fontWeight: current.bible.fontWeight, align: current.bible.align },
    appearance: { ...current.appearance, padding: scaled.appearance.padding, radius: scaled.appearance.radius },
    reference: { ...current.reference, ...scaled.reference, color: current.reference.color, position: current.reference.position, show: current.reference.show, align: current.reference.align },
  });
}

function render(status = getLivestreamStatus()) {
  if (!status.settings) return;
  statusText.textContent = status.error ? `متوقف: ${status.error}` : status.running ? `يعمل محليًا · ${status.clientCount} مصدر متصل` : "متوقف";
  statusText.dataset.state = status.error ? "error" : status.running ? "running" : "stopped";
  urlInput.value = status.url || "فعّل البث لإظهار الرابط";
  document.getElementById("livestream-visibility").textContent = status.visible ? "إخفاء النص" : "إظهار النص";
}

window.addEventListener("livestream-status", event => render(event.detail));
window.addEventListener("livestream-validation-error", event => showMessage(event.detail, true));
window.addEventListener("livestream-page-shown", () => { fill(getLivestreamStatus().settings); render(); showMessage(""); });

form?.addEventListener("input", updateSample);
form?.addEventListener("submit", async event => {
  event.preventDefault(); showMessage("");
  const button = document.getElementById("livestream-apply"); button.disabled = true;
  try { const result = await applyLivestreamSettings(collect()); fill(result.settings); showMessage("تم تطبيق الإعدادات ومسح المخرج بأمان"); }
  catch (error) { showMessage(error.message || "تعذر تطبيق الإعدادات", true); }
  finally { button.disabled = false; }
});

document.getElementById("livestream-cancel")?.addEventListener("click", () => { fill(getLivestreamStatus().settings); showMessage("تم إلغاء التعديلات"); });
document.getElementById("livestream-reset")?.addEventListener("click", () => { fill(DEFAULT_FORM_SETTINGS); showMessage("راجع القيم ثم اضغط تطبيق"); });
document.getElementById("livestream-open-preview")?.addEventListener("click", () => window.myCustomAPI.livestream.openPreview());
document.getElementById("livestream-visibility")?.addEventListener("click", async () => {
  const result = await window.myCustomAPI.livestream.setVisible(!getLivestreamStatus().visible); render(result);
});
document.getElementById("livestream-copy-url")?.addEventListener("click", async () => {
  const url = getLivestreamStatus().url;
  if (!url) return showMessage("فعّل البث أولًا لنسخ الرابط", true);
  await navigator.clipboard.writeText(url); showMessage("تم نسخ رابط مصدر المتصفح");
});
document.getElementById("livestream-preset-1080")?.addEventListener("click", () => applyCanvasPreset(1920, 1080));
document.getElementById("livestream-preset-720")?.addEventListener("click", () => applyCanvasPreset(1280, 720));
