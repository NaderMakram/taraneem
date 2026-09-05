import { previewSelectedChapter, previewSiblingChapter, continueToNextChapter } from "../src/helpers/bibleChapterPreview.js";
import { previewSelectedSong } from "../src/helpers/previewSelectedSong.js";
import { handleKeyDown } from "../src/helpers/handleKeyDown.js";
import { newSlide } from "../src/helpers/newSlide.js";

export async function run(chapters) {
  let checks = 0;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks++;
  };
  const updates = [];
  const scrolls = [];
  window.myCustomAPI = {
    getSiblingChapter: index => chapters[index],
    updateSongWindow: (html, isBible) => updates.push({ html, isBible }),
  };
  const realScroll = window.scrollTo.bind(window);
  let instantScroll = true;
  window.scrollTo = options => { scrolls.push(options); realScroll(instantScroll ? { ...options, behavior: "auto" } : options); };
  document.getElementById("startup-loader").remove();
  document.getElementById("siblingChaptersBtns").style.display = "flex";
  document.addEventListener("keydown", handleKeyDown);
  document.getElementById("prevChapter").addEventListener("click", () => previewSiblingChapter(-1));
  document.getElementById("nextChapter").addEventListener("click", () => previewSiblingChapter(1));
  const active = () => document.querySelector("#preview_output .active");
  const title = () => document.querySelector(".song-title").dataset.ref;
  const press = key => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, keyCode: key === "Enter" ? 13 : 0, bubbles: true, cancelable: true }));
  const select = selector => {
    active()?.classList.remove("active");
    const slide = document.querySelector(selector);
    slide.classList.add("active");
    newSlide(slide.innerHTML);
  };
  const waitForScroll = () => new Promise(resolve => setTimeout(resolve, 100));

  previewSelectedChapter(chapters[0]);
  const reference = document.querySelector(".chapter-continuation-reference");
  assert(reference.textContent === chapters[1].chapter_book + " ٢", "Continuation identifies the next book and chapter");
  assert(reference.nextElementSibling.classList.contains("chapter-peek"), "Reference appears before the faded verses");
  assert(!reference.closest(".chapter-peek"), "Reference stays outside the fade");
  assert(document.querySelectorAll(".chapter-peek-verse").length === 2, "Two next-chapter verses are visible");
  assert(document.querySelectorAll(".slide").length === Object.keys(chapters[0].verses).length + 1, "Peek verses never become current slides");
  assert(document.querySelector(".chapter-peek").textContent.includes(chapters[1].verses[1].split(" ").slice(1).join(" ")), "Preview uses next-chapter text");
  assert(document.querySelector(".chapter-end") === document.querySelector(".song-preview").lastElementChild, "Blank remains the last current slide");
  assert(document.querySelector("#prevChapter").style.display === "none", "First chapter has no previous button");
  assert(getComputedStyle(document.querySelector(".chapter-peek")).webkitMaskImage.includes("linear-gradient"), "Fade is applied by Chromium");

  assert(getComputedStyle(document.querySelector(".chapter-peek-verse .verse-number-center")).display === "none", "Default peek hides the alternate centered numeral");
  document.body.dataset.alignment = "center";
  assert(getComputedStyle(document.querySelector(".chapter-peek-verse .verse-number-center")).display === "block", "Centered peek shows its centered numeral");
  assert(getComputedStyle(document.querySelector(".chapter-peek-verse .verseNumber")).display === "none", "Centered peek hides the default numeral");
  delete document.body.dataset.alignment;
  select('.slide[data-verse-number="31"]');
  press("ArrowDown");
  assert(active().classList.contains("chapter-end"), "Last verse advances to blank first");
  assert(!updates.at(-1).html.includes("Gen 1"), "Blank output has no chapter heading");
  const before = updates.length;
  press("ArrowDown");
  assert(title() === chapters[1].custom_ref && active().dataset.verseNumber === "1", "Down from blank selects next chapter verse 1");
  assert(updates.length === before + 1 && updates.at(-1).isBible, "Continuation sends exactly one Bible output update");
  assert(updates.at(-1).html.includes("Gen 2") && !updates.at(-1).html.includes("Gen 1"), "Projected verse and chapter heading change together");
  assert(!updates.at(-1).html.includes("chapter-peek"), "Fade markup never reaches projection");
  assert(document.querySelector(".total-verse").textContent === "25", "Verse count changes with the chapter");
  assert(document.querySelector(".current-verse").textContent === "1", "Counter resets to first verse");
  await waitForScroll();
  assert(document.querySelector('.slide[data-verse-number="1"]').getBoundingClientRect().top >= document.getElementById("tools-bar").getBoundingClientRect().bottom, "Chapter start remains below the toolbar");
  const atChapterStart = () => document.querySelector(".slide[data-verse-number=\"1\"]").getBoundingClientRect().top <= document.getElementById("tools-bar").offsetHeight + document.querySelector(".song-title").offsetHeight + 25;
  assert(atChapterStart(), "Continuation returns to chapter start");

  press("ArrowUp");
  assert(title() === chapters[1].custom_ref && active().dataset.verseNumber === "1", "Up at verse 1 stays in the chapter");
  press("End");
  assert(active().dataset.verseNumber === "25", "End ignores next-chapter peek");
  press("Home");
  assert(active().dataset.verseNumber === "1", "Home selects current verse 1");
  press("2");
  press("Enter");
  assert(active().dataset.verseNumber === "2" && title() === chapters[1].custom_ref, "Numeric jump stays in current chapter");

  document.getElementById("prevChapter").click();
  await waitForScroll();
  const lastRect = document.querySelector(".chapter-end").getBoundingClientRect();
  assert(title() === chapters[0].custom_ref && !active(), "Previous button only previews the chapter");
  assert(Math.abs(lastRect.bottom - (window.innerHeight - 24)) < 3, "Previous chapter scrolls to its trailing blank slide");
  assert(updates.at(-1).html === "", "Chapter button preserves blank-output behavior");
  document.getElementById("nextChapter").click();
  await waitForScroll();
  assert(title() === chapters[1].custom_ref && atChapterStart(), "Next button scrolls to chapter start");

  for (const selector of [".chapter-peek-verse:first-child", ".chapter-peek-verse:last-child"]) {
    previewSelectedChapter(chapters[0]);
    const count = updates.length;
    document.querySelector(selector).click();
    assert(title() === chapters[1].custom_ref && active().dataset.verseNumber === "1" && updates.length === count + 1, "Clicking either peek enters at first verse once");
  }
  for (const key of ["Enter", " "]) {
    previewSelectedChapter(chapters[0]);
    const continuation = document.querySelector(".chapter-continuation");
    continuation.focus({ preventScroll: true });
    continuation.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    assert(title() === chapters[1].custom_ref && active().dataset.verseNumber === "1", "Focused continuation supports keyboard activation");
  }

  const psalm2 = chapters.findIndex(chapter => chapter.chapter_en === "Ps 2");
  previewSelectedChapter(chapters[psalm2]);
  assert(!document.querySelector(".chapter-peek").textContent.includes(chapters[psalm2 + 1].verses[0]), "Psalm heading is excluded from the two-verse peek");
  continueToNextChapter();
  assert(active().dataset.verseNumber === "1", "Psalm continuation selects verse 1 instead of the heading");
  assert(document.querySelector('.slide[data-verse-number="0"]'), "Psalm heading remains available in the full chapter");

  let bookEnds = 0;
  chapters.forEach((chapter, index) => {
    if (chapter.chapter_book_short !== chapters[index + 1]?.chapter_book_short) {
      previewSelectedChapter(chapter);
      assert(!document.querySelector(".chapter-continuation"), "Book end has no next-chapter peek");
      assert(document.getElementById("nextChapter").style.display === "none", "Book end has no next button");
      select(".chapter-end");
      const count = updates.length;
      press("ArrowDown");
      assert(title() === chapter.custom_ref && updates.length === count, "Down at a book end never crosses into another book");
      bookEnds++;
    }
  });
  assert(bookEnds === 66, "All 66 book boundaries covered");
  previewSelectedChapter(chapters[0]);
  previewSelectedSong({ title: "Test song", verses: [["Line 1"], ["Line 2"]], custom_ref: "song-test" });
  assert(!continueToNextChapter(), "Stale prepared Bible chapter cannot replace a song");
  select(".song-preview .slide:last-child");
  const count = updates.length;
  press("ArrowDown");
  assert(title() === "song-test" && updates.length === count, "Song end remains unchanged");

  previewSelectedChapter(chapters[0]);
  select(".chapter-end");
  instantScroll = false;
  const originalMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => query === "(prefers-reduced-motion: reduce)" ? { matches: false } : originalMatchMedia(query);
  continueToNextChapter();
  assert(scrolls.at(-1).behavior === "smooth", "Continuation requests native smooth scrolling");
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert(atChapterStart(), "Native smooth scrolling settles at the chapter start");
  window.matchMedia = query => query === "(prefers-reduced-motion: reduce)" ? { matches: true } : originalMatchMedia(query);
  previewSiblingChapter(-1);
  assert(scrolls.at(-1).behavior === "auto", "Reduced motion uses immediate scrolling");
  window.matchMedia = originalMatchMedia;
  instantScroll = true;

  const psalm116 = chapters.find(chapter => chapter.chapter_en === "Ps 116");
  window.prepareChapterScreenshot = async () => {
    previewSelectedChapter(psalm116);
    document.querySelector(".chapter-continuation").scrollIntoView({ block: "end" });
    await document.fonts.ready;
    await waitForScroll();
  };
  return `${checks} Electron integration assertions passed, including all 66 book boundaries.`;
}
