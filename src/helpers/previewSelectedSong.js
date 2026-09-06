import { previewSelectedChapter } from "./bibleChapterPreview.js";
import { attachLivestreamPart, beginLivestreamPreparation, createLivestreamParts, isLivestreamMode, registerLivestreamRebuild } from "./livestream-controller.js";
import { newSlide } from "./newSlide.js";

export { previewSelectedChapter };

const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function replaceLineBreaks(text) {
  return "<div class='verse-line'>" + text.replace(/\n/g, "</div><div class='verse-line'>").replace(/\d+/g, match =>
    `<span class="repeat-number">${match.split("").map(digit => arabicDigits[parseInt(digit)]).join("")}</span>`) + "</div>";
}

function restoreSelection(position) {
  if (!position) return;
  const candidates = Array.from(document.querySelectorAll("#preview_output .slide[data-live-part]"));
  const target = candidates.find(element => element.dataset.sourceId === position.sourceId && element.dataset.parentType === position.parentType &&
    element.dataset.parentNumber === position.parentNumber && Number(element.dataset.sourceStart) <= position.sourceStart &&
    Number(element.dataset.sourceEnd) >= position.sourceStart) ||
    candidates.find(element => element.dataset.parentType === position.parentType && element.dataset.parentNumber === position.parentNumber);
  if (target) { target.classList.add("active"); newSlide(target.innerHTML, { scroll: false }); }
}

function makeSongSlide({ classes, verseNumber = "", symbol = "", part }) {
  const div = document.createElement("div");
  div.classList.add(...classes, "slide");
  div.dataset.verseNumber = verseNumber;
  const numeral = verseNumber ? new Intl.NumberFormat("ar-EG").format(verseNumber) : "";
  const marker = document.createElement("span");
  marker.className = classes.includes("verse") ? "verseNumber" : "chorusSymbol";
  marker.textContent = classes.includes("verse") ? numeral : symbol;
  const body = document.createElement("div");
  for (const lineText of part.lines) { const line = document.createElement("div"); line.className = "verse-line"; line.textContent = lineText; body.appendChild(line); }
  div.append(marker, body);
  attachLivestreamPart(div, part);
  return div;
}

function prepareParentParts(texts, base) {
  const all = texts.flatMap((text, lineIndex) => createLivestreamParts({ ...base, text, sourceId: `${base.sourceId}:line:${lineIndex}` }));
  return all.map((part, index) => ({ ...part, partIndex: index + 1, partCount: all.length }));
}

export function previewSelectedSong(song) {
  beginLivestreamPreparation();
  const { title, chorus = [], verses = [], chorusFirst, custom_ref, lastKnownVerse } = song;
  const previewOutput = document.getElementById("preview_output");
  previewOutput.replaceChildren();
  const titleDiv = document.createElement("div");
  titleDiv.className = "song-title";
  titleDiv.dataset.ref = custom_ref;
  titleDiv.innerHTML = `<h4>${title}</h4><div class="verse-info active-info"><span class="current-verse"></span><span class="separator" style="display:none">/</span><span class="total-verse">${verses.length}</span></div>`;
  const container = document.createElement("div");
  container.className = "song-preview";
  previewOutput.append(titleDiv, container);
  const slides = [];

  if (isLivestreamMode()) {
    try {
      if ((chorusFirst && chorus.length) || verses.length === 0) {
      const parts = prepareParentParts(chorus, { sourceId: `song:${custom_ref}:chorus:initial`, kind: "song", parentType: "chorus", parentNumber: null, reference: title });
      parts.forEach((part, index) => slides.push(makeSongSlide({ classes: ["chorus", "initial-chorus"], symbol: index === 0 ? "ق" : "", part })));
    }
    verses.forEach((verse, verseIndex) => {
      const number = verseIndex + 1;
      const parts = prepareParentParts(verse, { sourceId: `song:${custom_ref}:verse:${number}`, kind: "song", parentType: "verse", parentNumber: number, reference: title });
      parts.forEach(part => slides.push(makeSongSlide({ classes: ["verse"], verseNumber: number, part })));
      if (chorus.length) {
        const chorusParts = prepareParentParts(chorus, { sourceId: `song:${custom_ref}:chorus:after:${number}`, kind: "song", parentType: "chorus", parentNumber: null, reference: title });
        chorusParts.forEach((part, index) => slides.push(makeSongSlide({ classes: ["chorus"], verseNumber: "", symbol: index === 0 ? "ق" : "", part })));
      }
      if (verseIndex === lastKnownVerse - 1) {
        const blank = document.createElement("div"); blank.className = "verse slide lastKnownVerse"; blank.innerHTML = '<span class="verseNumber"></span><div></div>'; slides.push(blank);
      }
    });
    } catch (_error) { slides.length = 0; }
  } else {
    if ((chorus && chorusFirst && chorus.length > 0) || verses.length === 0) chorus.forEach(line => {
      const div = document.createElement("div"); div.className = "chorus slide initial-chorus"; div.innerHTML = replaceLineBreaks(line); slides.push(div);
    });
    verses.forEach((verse, verseIndex) => {
      verse.forEach((line, lineIndex) => {
        const number = lineIndex === 0 ? verseIndex + 1 : "";
        const div = document.createElement("div"); div.className = "verse slide"; div.dataset.verseNumber = number;
        div.innerHTML = `<span class="verseNumber">${number ? new Intl.NumberFormat("ar-EG").format(number) : ""}</span><div>${replaceLineBreaks(line)}</div>`; slides.push(div);
      });
      chorus.forEach((line, chorusIndex) => {
        const div = document.createElement("div"); div.className = "chorus slide"; div.dataset.verseNumber = verseIndex + 1;
        div.innerHTML = `<span class="chorusSymbol">${chorusIndex === 0 ? "ق" : ""}</span> ${replaceLineBreaks(line)}`; slides.push(div);
      });
      if (verseIndex === lastKnownVerse - 1) { const blank = document.createElement("div"); blank.className = "verse slide lastKnownVerse"; blank.innerHTML = '<span class="verseNumber"></span><div></div>'; slides.push(blank); }
    });
  }
  const finalBlank = document.createElement("div"); finalBlank.className = "verse slide"; finalBlank.innerHTML = '<span class="verseNumber"></span><div></div>'; slides.push(finalBlank);
  slides.forEach((slide, index) => {
    slide.style.opacity = "0"; slide.style.transform = "translateY(20px)"; container.appendChild(slide);
    setTimeout(() => { slide.style.opacity = "1"; slide.style.transform = "translateY(0)"; }, 100 / (index + 1));
  });
  registerLivestreamRebuild(position => { previewSelectedSong(song); restoreSelection(position); });
}
