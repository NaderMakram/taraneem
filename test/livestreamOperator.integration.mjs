import { initializeLivestreamController, applyLivestreamSettings, getLivestreamStatus, getLivestreamValidationError, measureLivestreamText } from "../src/helpers/livestream-controller.js";
import { previewSelectedSong } from "../src/helpers/previewSelectedSong.js";
import { previewSelectedChapter, previewSiblingChapter } from "../src/helpers/bibleChapterPreview.js";
import { handleKeyDown } from "../src/helpers/handleKeyDown.js";
import { newSlide } from "../src/helpers/newSlide.js";
import "../src/helpers/livestream-settings.js";

let listenersAttached = false;
export async function setup() {
  await initializeLivestreamController();
  if (!listenersAttached) {
    document.addEventListener("keydown", handleKeyDown);
    document.getElementById("preview_output").addEventListener("click", event => {
      const slide = event.target.closest(".verse, .chorus, .bible-verse");
      if (!slide) return;
      document.querySelectorAll("#preview_output .slide").forEach(item => item.classList.remove("active"));
      slide.classList.add("active");
      newSlide(slide.innerHTML);
    });
    listenersAttached = true;
  }
  return getLivestreamStatus();
}

export async function setMode(enabled, port) {
  const current = getLivestreamStatus().settings;
  return applyLivestreamSettings({ ...current, enabled, ...(port ? { port } : {}) });
}

export function previewBible(chapter) {
  previewSelectedChapter(chapter);
  const verseNine = Array.from(document.querySelectorAll('[data-parent-type="verse"][data-parent-number="9"]'));
  return {
    partCount: verseNine.length,
    reconstructed: verseNine.flatMap(element => Array.from(element.querySelectorAll(".verse-line"), line => line.textContent)).join("").replace(/\s/gu, ""),
    sourceIds: [...new Set(verseNine.map(element => element.dataset.sourceId))],
  };
}

export function clickBiblePart(number, partIndex = 1) {
  const selector = `[data-parent-type="verse"][data-parent-number="${number}"][data-part-index="${partIndex}"]`;
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Missing ${selector}`);
  target.click();
  return activeInfo();
}

export function arrow(key) {
  document.activeElement?.blur?.();
  document.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }));
  return activeInfo();
}

export function numericJump(digits) {
  document.activeElement?.blur?.();
  for (const digit of String(digits)) document.dispatchEvent(new KeyboardEvent("keydown", { key: digit, code: `Digit${digit}`, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
  return activeInfo();
}

export function clearViaChapterNavigation() {
  return previewSiblingChapter(1);
}

export function previewSong(song) {
  previewSelectedSong(song);
  return Array.from(document.querySelectorAll('[data-parent-type="chorus"]')).map(element => element.dataset.sourceId);
}

export function selectSource(sourceId, partIndex = 1) {
  const target = Array.from(document.querySelectorAll(`[data-source-id="${CSS.escape(sourceId)}"]`)).find(element => Number(element.dataset.partIndex) === partIndex);
  if (!target) throw new Error(`Missing source ${sourceId}`);
  target.click(); return activeInfo();
}

export async function reflowSong(lines) {
  const current = getLivestreamStatus().settings;
  await applyLivestreamSettings({ ...current, song: { ...current.song, maxLines: lines } });
  return activeInfo();
}

export async function setFont(font) {
  const current = getLivestreamStatus().settings;
  await applyLivestreamSettings({ ...current, song: { ...current.song, font }, bible: { ...current.bible, font } });
  return getLivestreamStatus();
}
export async function setReferenceBox(position, width) {
  const current = getLivestreamStatus().settings;
  await applyLivestreamSettings({ ...current, reference: { ...current.reference, position, width } });
  return getLivestreamValidationError();
}
export function measurement(text, kind) { return measureLivestreamText(text, kind); }
export function validationError() { return getLivestreamValidationError(); }
export async function applyPreset(name) {
  window.dispatchEvent(new CustomEvent("livestream-page-shown"));
  document.getElementById(`livestream-preset-${name}`).click();
  const form = document.getElementById("livestream-form");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 250));
  return { status: getLivestreamStatus(), message: document.getElementById("livestream-message").textContent };
}

export async function applyReferenceAlignment(align) {
  document.getElementById("livestream-reference-align").value = align;
  const form = document.getElementById("livestream-form");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 250));
  return getLivestreamStatus().settings.reference.align;
}

export async function configureNarrowText() {
  const current = getLivestreamStatus().settings;
  await applyLivestreamSettings({ ...current, textArea: { ...current.textArea, width: 120 }, song: { ...current.song, fontSize: 24, minFontSize: 20 }, appearance: { ...current.appearance, padding: 0 }, reference: { ...current.reference, show: false } });
  return getLivestreamStatus();
}

export function previewImpossibleSong() {
  previewSelectedSong({ title: "اختبار الخطأ", chorus: ["كلمة".repeat(100)], verses: [], chorusFirst: true, custom_ref: "impossible", lastKnownVerse: 0 });
  return { error: getLivestreamValidationError(), parts: document.querySelectorAll("[data-live-part]").length };
}

export function previewImpossibleBible() {
  previewSelectedChapter({ chapter_book: "سفر طويل", chapter_book_short: "س", chapter_number: 1, chapter_en: "Test", custom_ref: "impossible-bible", siblings: [null, null], verses: { "1": "نور", "2": "كلمة".repeat(100) } });
  return { error: getLivestreamValidationError(), parts: document.querySelectorAll("[data-live-part]").length, usable: Boolean(document.querySelector(".chapter-end") && document.getElementById("livestream-preview-error")) };
}

export async function setVisible(visible) {
  return window.myCustomAPI.livestream.setVisible(visible);
}

export function activeInfo() {
  const active = document.querySelector("#preview_output .slide.active");
  return active ? {
    sourceId: active.dataset.sourceId,
    parentType: active.dataset.parentType,
    parentNumber: active.dataset.parentNumber,
    partIndex: Number(active.dataset.partIndex || 0),
    partCount: Number(active.dataset.partCount || 0),
    text: Array.from(active.querySelectorAll(".verse-line"), line => line.textContent).join("\n"),
  } : null;
}
