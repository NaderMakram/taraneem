import { buildSongSlides } from "./songSlides.mjs";

export function previewSelectedChapter(chapter) {
  let {
    chapter_en,
    chapter_book,
    chapter_book_short,
    chapter_number,
    verses,
    siblings,
    prevShort,
    prevNum,
    nextShort,
    nextNum,
    custom_ref,
  } = chapter;
  let chapter_number_ar = new Intl.NumberFormat("ar-EG").format(chapter_number);

  function truncate(str, max_length) {
    return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
  }

  const prevChapterBtn = document.querySelector("#prevChapter");
  const nextChapterBtn = document.querySelector("#nextChapter");

  if (chapter_book_short == prevShort) {
    prevChapterBtn.setAttribute("data-chapterIndex", siblings[0]);
    prevChapterBtn.innerHTML = prevNum;
    prevChapterBtn.style.display = "block";
  } else {
    prevChapterBtn.style.display = "none";
  }
  if (chapter_book_short == nextShort) {
    nextChapterBtn.setAttribute("data-chapterIndex", siblings[1]);
    nextChapterBtn.innerHTML = nextNum;
    nextChapterBtn.style.display = "block";
  } else {
    nextChapterBtn.style.display = "none";
  }

  // Clear previous content
  preview_output.innerHTML = "";

  // Create and append the song title immediately (no animation)
  let titleDiv = document.createElement("div");
  titleDiv.classList.add("song-title");
  titleDiv.dataset.ref = custom_ref;
  titleDiv.innerHTML = `
    <h4>${chapter_book} ${chapter_number_ar}</h4>
    <div class="verse-info active-info">
      <span class="current-verse"></span>
      <span class="separator" style="display: none;">/</span>
      <span class="total-verse">${
        Object.keys(verses).filter((key) => key !== "0").length
      }</span>
    </div>
  `;
  preview_output.appendChild(titleDiv);

  // Create and append the chapter title (hidden by default)
  let chapterTitleEn = document.createElement("h4");
  chapterTitleEn.classList.add("chapter-title-en");
  chapterTitleEn.style.display = "none";
  chapterTitleEn.textContent = chapter_en;
  preview_output.appendChild(chapterTitleEn);

  // Create and append the container immediately (no animation)
  let container = document.createElement("div");
  container.classList.add("song-preview");
  preview_output.appendChild(container);

  let slides = [];

  // Prepare verse slides without appending them yet
  // Prepare verse slides without appending them yet
  for (const [key, value] of Object.entries(verses)) {
    let div = document.createElement("div");
    div.classList.add("bible-verse", "slide");
    div.dataset.verseNumber = key;

    let verseNumAr = key == 0 ? "" : new Intl.NumberFormat("ar-EG").format(key);

    // Split first word for center alignment grouping
    // We want the verse number to be attached to the first word in center mode
    let parts = value.split(" ");
    let firstWord = parts[0];
    let restOfVerse = parts.length > 1 ? " " + parts.slice(1).join(" ") : "";

    div.innerHTML = `
    <span class="verseNumber">${verseNumAr}</span>
    <div>
        <span class="first-word-wrapper">
            <span class="verse-number-center">${verseNumAr}</span>
            ${firstWord}
        </span>${restOfVerse}
    </div>
  `;
    slides.push(div);
  }
  // Add an empty slide at the end
  let emptySlide = document.createElement("div");
  emptySlide.classList.add("bible-verse", "slide");
  emptySlide.innerHTML = `<span class="verseNumber"></span><div></div>`;
  slides.push(emptySlide);

  // Animate slides one by one
  slides.forEach((slide, index) => {
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";
    container.appendChild(slide); // Append to DOM first

    let time = 100 / (index + 1);
    // let time = Math.pow(4, index) * 50;
    // let time = index * 50;
    // console.log(`time: ${50 * Math.pow(0.95, index)}`);

    setTimeout(() => {
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, time);
  });
}
// preview selected song
export function previewSelectedSong(song) {
  const { title, verses, custom_ref } = song;

  // Clear previous content
  preview_output.innerHTML = "";

  // Create and append the song title immediately
  let titleDiv = document.createElement("div");
  titleDiv.classList.add("song-title");
  titleDiv.dataset.ref = custom_ref;
  titleDiv.innerHTML = `
  <h4>${title}</h4>
  <div class="verse-info active-info">
  <span class="current-verse"></span>
  <span class="separator" style="display: none;">/</span>
  <span class="total-verse">${verses.length}</span>
  </div>
  `;
  preview_output.appendChild(titleDiv);

  // Create and append the container immediately
  let container = document.createElement("div");
  container.classList.add("song-preview");
  preview_output.appendChild(container);

  const slides = buildSongSlides(song).map((slide) => {
    const div = document.createElement("div");
    div.classList.add(slide.kind, "slide");
    if (slide.initial) div.classList.add("initial-chorus");
    if (slide.lastKnownVerse) div.classList.add("lastKnownVerse");
    if (slide.verseNumber !== undefined) div.dataset.verseNumber = slide.verseNumber;
    div.innerHTML = slide.blank ? '<span class="verseNumber"></span><div></div>' : slide.html;
    return div;
  });

  // Animate slides one by one
  slides.forEach((slide, index) => {
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";
    container.appendChild(slide);

    let time = 100 / (index + 1);
    setTimeout(() => {
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, time);
  });
}
