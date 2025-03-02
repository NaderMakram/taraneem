export function previewSelectedChapter(chapter) {
  console.log(`chapter: ${chapter}`);
  let {
    chapter_en,
    chapter_book,
    chapter_number,
    verses,
    siblings,
    prevShort,
    prevNum,
    nextShort,
    chapter_name,
    nextNum,
    custom_ref,
  } = chapter;
  let chapter_number_ar = new Intl.NumberFormat("ar-EG").format(chapter_number);

  const prevChapterBtn = document.querySelector("#prevChapter");
  const nextChapterBtn = document.querySelector("#nextChapter");

  prevChapterBtn.setAttribute("data-chapterIndex", siblings[0]);
  nextChapterBtn.setAttribute("data-chapterIndex", siblings[1]);

  prevChapterBtn.innerHTML = `${prevShort}<br/>${prevNum}`;
  nextChapterBtn.innerHTML = `${nextShort}<br/>${nextNum}`;

  // window.myCustomAPI.getSiblingChapters(siblings)
  // console.log(siblings)

  let html = `<div class="song-title" data-ref="${custom_ref}">
  <h4>${chapter_book + "  " + chapter_number_ar}</h4>
  <div class="verse-info">
  <span class="total-verse">${
    Object.keys(verses).filter((key) => key !== "0").length
  }</span>
  <span>/</span>
  <span class="current-verse"></span>
  </div>
  </div>`;

  html += `<h4 class="chapter-title-en" style="display: none;">${chapter_en}</h4>`;
  html += `<div class="song-preview">`;
  // console.log(verses);

  for (const [key, value] of Object.entries(verses)) {
    // console.log(`Key: ${key}, Value: ${value}`);
  }

  for (const [key, value] of Object.entries(verses)) {
    // console.log(value);

    // add verse number for the first line in a verse
    html += `<div class="bible-verse slide" data-verseNumber="${key}">
            <span class="verseNumber">${new Intl.NumberFormat("ar-EG").format(
              key
            )}</span>
            <div>
            ${value}
            </div>
            </div>`;
  }

  // add empty slide
  html += `<div class="bible-verse slide">
  <span class="verseNumber"></span>
  <div></div>
  </div>`;
  html += `</div>`;
  return html;
}

// preview selected song
export function previewSelectedSong(song) {
  console.log(song);
  let { title, chorus, verses, chorusFirst, scale, custom_ref } = song;
  // Clear previous content
  preview_output.innerHTML = "";

  // Create and append the song title immediately (no animation)
  let titleDiv = document.createElement("div");
  titleDiv.classList.add("song-title");
  titleDiv.dataset.ref = custom_ref;
  titleDiv.innerHTML = `
    <h4>${title}</h4>
    <div class="verse-info">
      <span class="total-verse">${verses.length}/</span>
      <span class="current-verse"></span>
    </div>
  `;
  preview_output.appendChild(titleDiv);

  // Create and append the container immediately (no animation)
  let container = document.createElement("div");
  container.classList.add("song-preview");
  preview_output.appendChild(container);

  const replaceLineBreaks = (text) => text.replace(/\n/g, "<br>");
  let slides = [];

  // Prepare slides without appending them yet
  if ((chorusFirst && chorus.length > 0) || verses.length === 0) {
    chorus.forEach((line) => {
      let div = document.createElement("div");
      div.classList.add("chorus", "slide");
      div.innerHTML = replaceLineBreaks(line);
      slides.push(div);
    });
  }

  if (verses.length > 0) {
    verses.forEach((verse, verseIndex) => {
      verse.forEach((line, lineIndex) => {
        let verseNumber = lineIndex === 0 ? verseIndex + 1 : "";
        let arabicNumber = verseNumber
          ? new Intl.NumberFormat("ar-EG").format(verseNumber)
          : "";

        let div = document.createElement("div");
        div.classList.add("verse", "slide");
        div.dataset.verseNumber = verseNumber;
        div.innerHTML = `<span class="verseNumber">${arabicNumber}</span><div>${replaceLineBreaks(
          line
        )}</div>`;
        slides.push(div);
      });

      if (chorus && chorus.length > 0) {
        chorus.forEach((chorusLine, chorusIndex) => {
          let chorusSymbol = chorusIndex === 0 ? "ق" : "";

          let div = document.createElement("div");
          div.classList.add("chorus", "slide");
          div.dataset.verseNumber = verseIndex + 1;
          div.innerHTML = `<span class="chorusSymbol">${chorusSymbol}</span> ${replaceLineBreaks(
            chorusLine
          )}`;
          slides.push(div);
        });
      }
    });
  }

  // Animate slides one by one
  slides.forEach((slide, index) => {
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";
    container.appendChild(slide); // Append to DOM first

    setTimeout(() => {
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, index * 100);
  });
}
