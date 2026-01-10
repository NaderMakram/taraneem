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
    <div class="verse-info">
      <span class="total-verse">${
        Object.keys(verses).filter((key) => key !== "0").length
      }</span>
      <span>/</span>
      <span class="current-verse"></span>
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
  for (const [key, value] of Object.entries(verses)) {
    let div = document.createElement("div");
    div.classList.add("bible-verse", "slide");
    div.dataset.verseNumber = key;
    div.innerHTML = `
    <span class="verseNumber">${
     key == 0 ? "" : new Intl.NumberFormat("ar-EG").format(key)
     }</span>
    <div>${value}</div>
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
  const alignMode = document.querySelector("#alignBtn").value;
  // Expected values: "default", "top-1", "top-2", "bottom-1", "bottom-2"
  console.log("Alignment Mode:", alignMode);

  let { title, chorus, verses, chorusFirst, custom_ref, lastKnownVerse } = song;

  // Clear previous content
  preview_output.innerHTML = "";

  // Create and append the song title immediately
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

  // Create and append the container immediately
  let container = document.createElement("div");
  container.classList.add("song-preview");
  preview_output.appendChild(container);

  // --- Helper: Format Text (HTML & Arabic Digits) ---
  const replaceLineBreaks = (text) => {
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return (
      "<div class='verse-line'>" +
      text
        .replace(/\n/g, "</div><div class='verse-line'>")
        .replace(/\d+/g, (match) => {
          const arabicNumber = match
            .split("")
            .map((digit) => arabicDigits[parseInt(digit)])
            .join("");
          return `<span class="repeat-number">${arabicNumber}</span>`;
        }) +
      "</div>"
    );
  };

  // --- Helper: Split Logic based on Alignment State ---
  const splitTextIntoChunks = (text) => {
    // 1. If default, do not split
    if (alignMode === "default") return [text];

    // 2. Determine max lines allowed based on the state name
    // If it contains "-1", max is 1. If "-2", max is 2.
    let maxLines = 2; // Fallback
    if (alignMode.includes("-1")) maxLines = 1;
    if (alignMode.includes("-2")) maxLines = 2;

    const lines = text.split("\n");

    // 3. Optimization: if current lines <= maxLines, return as single chunk
    if (lines.length <= maxLines) return [text];

    // 4. Chunk the lines
    const chunks = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      // Slice the array from current index to current index + limit
      const chunk = lines.slice(i, i + maxLines).join("\n");
      chunks.push(chunk);
    }
    return chunks;
  };

  let slides = [];

  // --- 1. Initial Chorus ---
  if ((chorus && chorusFirst && chorus.length > 0) || verses.length === 0) {
    chorus.forEach((line) => {
      const chunks = splitTextIntoChunks(line); // Split based on mode

      chunks.forEach((chunkText) => {
        let div = document.createElement("div");
        div.classList.add("chorus", "slide");
        div.innerHTML = replaceLineBreaks(chunkText);
        slides.push(div);
      });
    });
  }

  // --- 2. Verses Loop ---
  if (verses.length > 0) {
    verses.forEach((verse, verseIndex) => {
      verse.forEach((line, lineIndex) => {
        const chunks = splitTextIntoChunks(line); // Split based on mode

        chunks.forEach((chunkText, chunkIndex) => {
          // Logic: Only show number on the FIRST chunk of the verse line
          let showNumber = lineIndex === 0 && chunkIndex === 0;
          let verseNumber = showNumber ? verseIndex + 1 : "";

          let arabicNumber = verseNumber
            ? new Intl.NumberFormat("ar-EG").format(verseNumber)
            : "";

          let div = document.createElement("div");
          div.classList.add("verse", "slide");
          div.dataset.verseNumber = verseNumber;

          div.innerHTML = `<span class="verseNumber">${arabicNumber}</span><div>${replaceLineBreaks(
            chunkText
          )}</div>`;
          slides.push(div);
        });
      });

      // --- 3. Chorus after Verse ---
      if (chorus && chorus.length > 0) {
        chorus.forEach((chorusLine, chorusIndex) => {
          const chunks = splitTextIntoChunks(chorusLine); // Split based on mode

          chunks.forEach((chunkText, chunkIndex) => {
            // Logic: Only show 'ق' on the FIRST chunk of the first chorus line
            let showSymbol = chorusIndex === 0 && chunkIndex === 0;
            let chorusSymbol = showSymbol ? "ق" : "";

            let div = document.createElement("div");
            div.classList.add("chorus", "slide");
            div.dataset.verseNumber = verseIndex + 1;
            div.innerHTML = `<span class="chorusSymbol">${chorusSymbol}</span> ${replaceLineBreaks(
              chunkText
            )}`;
            slides.push(div);
          });
        });
      }

      // Add empty slide after last known verse
      if (verseIndex === lastKnownVerse - 1) {
        let emptySlide = document.createElement("div");
        emptySlide.classList.add("verse", "slide", "lastKnownVerse");
        emptySlide.innerHTML = `<span class="verseNumber"></span><div></div>`;
        slides.push(emptySlide);
      }
    });
  }

  // create empty div at the end
  let emptySlide = document.createElement("div");
  emptySlide.classList.add("verse", "slide");
  emptySlide.innerHTML = `<span class="verseNumber"></span><div></div>`;
  slides.push(emptySlide);

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
