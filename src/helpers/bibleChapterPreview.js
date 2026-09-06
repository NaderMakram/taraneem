import { newSlide } from "./newSlide.js";
import { attachLivestreamPart, beginLivestreamPreparation, createLivestreamParts, getLivestreamValidationError, isLivestreamMode, registerLivestreamRebuild, renderLivestreamValidationError } from "./livestream-controller.js";

let currentPreview = null;
let nextPreview = null;

function sibling(chapter, direction) {
  const index = chapter.siblings?.[direction < 0 ? 0 : 1];
  if (!Number.isInteger(index)) return null;
  const candidate = window.myCustomAPI.getSiblingChapter(index);
  return candidate?.chapter_book_short === chapter.chapter_book_short ? candidate : null;
}

function createLegacyVerse(number, text) {
  const slide = document.createElement("div"); slide.className = "bible-verse slide"; slide.dataset.verseNumber = number;
  const numeral = number === "0" ? "" : new Intl.NumberFormat("ar-EG").format(number);
  const [firstWord, ...rest] = text.split(" ");
  const numberSpan = document.createElement("span"); numberSpan.className = "verseNumber"; numberSpan.textContent = numeral;
  const body = document.createElement("div"); const first = document.createElement("span"); first.className = "first-word-wrapper";
  const centered = document.createElement("span"); centered.className = "verse-number-center"; centered.textContent = numeral;
  first.append(centered, ` ${firstWord}`); body.append(first, rest.length ? ` ${rest.join(" ")}` : ""); slide.append(numberSpan, body);
  return slide;
}

function createVerses(chapter, number, text) {
  if (!isLivestreamMode()) return [createLegacyVerse(number, text)];
  const isHeading = number === "0";
  const reference = isHeading ? null : `${chapter.chapter_book} ${new Intl.NumberFormat("ar-EG").format(chapter.chapter_number)}:${new Intl.NumberFormat("ar-EG").format(number)}`;
  const parts = createLivestreamParts({ text, sourceId: `bible:${chapter.custom_ref}:verse:${number}`, kind: isHeading ? "heading" : "bible", parentType: isHeading ? "heading" : "verse", parentNumber: isHeading ? null : number, reference });
  return parts.map(part => {
    const slide = createLegacyVerse(number, part.lines.join("\n"));
    const body = slide.lastElementChild;
    body.replaceChildren();
    for (const text of part.lines) { const line = document.createElement("div"); line.className = "verse-line"; line.textContent = text; body.appendChild(line); }
    attachLivestreamPart(slide, part);
    return slide;
  });
}

function prepareChapter(chapter) {
  const root = document.createDocumentFragment();
  const title = document.createElement("div"); title.className = "song-title"; title.dataset.ref = chapter.custom_ref;
  const heading = document.createElement("h4"); heading.textContent = `${chapter.chapter_book} ${new Intl.NumberFormat("ar-EG").format(chapter.chapter_number)}`;
  const info = document.createElement("div"); info.className = "verse-info active-info";
  info.innerHTML = '<span class="current-verse"></span><span class="separator" style="display:none">/</span><span class="total-verse"></span>';
  info.querySelector(".total-verse").textContent = Object.keys(chapter.verses).filter(key => key !== "0").length;
  title.append(heading, info);
  const englishTitle = document.createElement("h4"); englishTitle.className = "chapter-title-en"; englishTitle.style.display = "none"; englishTitle.textContent = chapter.chapter_en;
  const container = document.createElement("div"); container.className = "song-preview";
  let verses;
  try { verses = Object.entries(chapter.verses).flatMap(([number, text]) => createVerses(chapter, number, text)); }
  catch (_error) { verses = []; }
  const failed = Boolean(getLivestreamValidationError());
  if (failed) verses = [];
  const blank = document.createElement("div"); blank.className = "bible-verse slide chapter-end"; blank.innerHTML = '<span class="verseNumber"></span><div></div>';
  container.append(...verses, blank); root.append(title, englishTitle, container);
  return { chapter, root, title, container, verses, failed };
}

function restoreSelection(position) {
  if (!position) return;
  const candidates = Array.from(document.querySelectorAll("#preview_output .slide[data-live-part]"));
  const target = candidates.find(element => element.dataset.sourceId === position.sourceId && element.dataset.parentType === position.parentType && element.dataset.parentNumber === position.parentNumber &&
    Number(element.dataset.sourceStart) <= position.sourceStart && Number(element.dataset.sourceEnd) >= position.sourceStart) ||
    candidates.find(element => element.dataset.parentType === position.parentType && element.dataset.parentNumber === position.parentNumber);
  if (target) { target.classList.add("active"); newSlide(target.innerHTML, { scroll: false }); }
}

function showChapter(preview) {
  currentPreview = preview;
  const following = sibling(preview.chapter, 1);
  nextPreview = following && !isLivestreamMode() ? prepareChapter(following) : null;
  if (following) {
    const continuation = document.createElement("div"); continuation.className = "chapter-continuation"; continuation.setAttribute("role", "button"); continuation.tabIndex = 0;
    const label = `الانتقال إلى ${following.chapter_name}، الآية ١`; continuation.setAttribute("aria-label", label); continuation.title = label;
    const peek = document.createElement("div"); peek.className = "chapter-peek"; peek.setAttribute("aria-hidden", "true");
    const peekVerses = nextPreview?.verses || Object.entries(following.verses).filter(([number]) => number !== "0").slice(0, 2).map(([number, text]) => createLegacyVerse(number, text));
    peekVerses.filter(verse => Number(verse.dataset.verseNumber) > 0).filter((verse, index, all) => index === all.findIndex(item => item.dataset.verseNumber === verse.dataset.verseNumber)).slice(0, 2).forEach(verse => {
      const clone = verse.cloneNode(true); clone.className = "chapter-peek-verse"; clone.removeAttribute("data-verse-number"); peek.appendChild(clone);
    });
    const reference = document.createElement("h4"); reference.className = "chapter-continuation-reference";
    reference.textContent = `${following.chapter_book} ${new Intl.NumberFormat("ar-EG").format(following.chapter_number)}`;
    continuation.append(reference, peek); continuation.addEventListener("click", continueToNextChapter);
    continuation.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); continueToNextChapter(); } });
    preview.root.appendChild(continuation);
  }
  document.getElementById("preview_output").replaceChildren(preview.root);
  if (preview.failed) renderLivestreamValidationError();
  for (const [id, direction] of [["prevChapter", -1], ["nextChapter", 1]]) {
    const button = document.getElementById(id); const chapter = sibling(preview.chapter, direction); button.style.display = chapter ? "block" : "none";
    if (chapter) { button.dataset.chapterindex = preview.chapter.siblings[direction < 0 ? 0 : 1]; button.textContent = chapter.chapter_number; }
    else button.removeAttribute("data-chapterindex");
  }
  registerLivestreamRebuild(position => { beginLivestreamPreparation(); showChapter(prepareChapter(preview.chapter)); restoreSelection(position); });
}

function scrollChapter(direction) {
  const verses = currentPreview.verses.filter(verse => Number(verse.dataset.verseNumber) > 0);
  const target = direction < 0 ? currentPreview.container.querySelector(".chapter-end") : verses[0]; if (!target) return;
  const rect = target.getBoundingClientRect(); const toolbarHeight = document.getElementById("tools-bar")?.offsetHeight || 0;
  const top = direction < 0 ? window.scrollY + rect.bottom - window.innerHeight + 24 : window.scrollY + rect.top - toolbarHeight - currentPreview.title.offsetHeight - 24;
  window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

export function previewSelectedChapter(chapter) { beginLivestreamPreparation(); showChapter(prepareChapter(chapter)); }
export function previewSiblingChapter(direction, { selectFirst = false } = {}) {
  if (!currentPreview?.container.isConnected) return false;
  const chapter = sibling(currentPreview.chapter, direction); if (!chapter) return false;
  beginLivestreamPreparation();
  const prepared = direction > 0 && nextPreview ? nextPreview : prepareChapter(chapter);
  document.querySelector(".selectedSong")?.classList.remove("selectedSong"); showChapter(prepared);
  if (selectFirst) {
    const first = currentPreview.verses.find(verse => verse.dataset.verseNumber === "1"); first?.classList.add("active"); if (first) newSlide(first.innerHTML, { scroll: false });
  } else { window.myCustomAPI.updateSongWindow(""); }
  scrollChapter(direction); return true;
}
export function continueToNextChapter() { return previewSiblingChapter(1, { selectFirst: true }); }
