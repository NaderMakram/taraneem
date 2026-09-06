import { trackPresentationFromSlide } from "./presentationMeta.js";
import { publishCurrentLivestreamSlide } from "./livestream-controller.js";

export function newSlide(html = "", { scroll = true } = {}) {
  document.querySelector(".pause")?.classList.remove("pause");
  const activeElement = document.querySelector("#preview_output .slide.active");
  if (activeElement) {
    const targetElement = activeElement.dataset.parentType === "verse" ? activeElement :
      (activeElement.getAttribute("data-verse-number") ? activeElement : activeElement.previousElementSibling?.closest("[data-verse-number]"));
    if (!targetElement && activeElement.classList.contains("initial-chorus")) {
      const current = document.querySelector(".current-verse"); if (current) current.textContent = "1";
      const separator = document.querySelector(".separator"); if (separator) separator.style.display = "inline";
    } else if (targetElement) {
      const verseNumber = targetElement.dataset.parentNumber || targetElement.getAttribute("data-verse-number");
      const current = document.querySelector(".current-verse"); if (current && verseNumber) current.textContent = verseNumber;
      const separator = document.querySelector(".separator"); if (separator && verseNumber) separator.style.display = "inline";
    }
  }
  trackPresentationFromSlide(html);
  if (scroll && activeElement) {
    window.scrollTo({ top: activeElement.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3, left: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  publishCurrentLivestreamSlide();
  const isBible = Boolean(document.querySelector("#preview_output .slide.bible-verse"));
  if (isBible) {
    const songTitle = document.querySelector(".song-title");
    const englishTitle = document.querySelector(".chapter-title-en");
    const chapterTitle = songTitle && englishTitle ? songTitle.outerHTML + englishTitle.outerHTML : "";
    const combined = `<div class="container bible-container"><div class="head bible-head">${html.length > 53 ? chapterTitle : ""}</div><div class="body bible-body">${html}</div></div>`;
    window.myCustomAPI.updateSongWindow(combined, true);
  } else {
    window.myCustomAPI.updateSongWindow(`<div class="container song-container"><div class="body song-body">${html}</div></div>`, false);
  }
}
