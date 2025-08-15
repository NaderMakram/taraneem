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
      <span class="verseNumber">${new Intl.NumberFormat("ar-EG").format(
        key
      )}</span>
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
  console.log(song);
  let { title, chorus, verses, chorusFirst, custom_ref } = song;
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

  // Helper function to extract first part (before first <br>) from HTML content and remove spans
  const getFirstPart = (htmlContent) => {
    let firstPart = htmlContent.split("<br>")[0];
    // Remove any span tags and their content
    firstPart = firstPart.replace(/<span[^>]*>.*?<\/span>/gi, "");
    // remove any html tags
    firstPart = firstPart.replace(/<\/?[^>]+(>|$)/g, "");
    return firstPart.trim();
  };

  let slides = [];

  // Function to add next slide starting line to the last slide
  const addNextSlideStartingLine = (currentSlideContent) => {
    if (slides.length > 0) {
      let firstPart = getFirstPart(currentSlideContent);
      console.log("firstPart", firstPart);
      firstPart == "" ? (firstPart = "-----------") : firstPart;
      const nextSlideDiv = document.createElement("div");
      nextSlideDiv.classList.add("next_slide_starting_line");
      nextSlideDiv.innerHTML = firstPart;
      slides[slides.length - 1].appendChild(nextSlideDiv);
    }
  };

  // Prepare slides without appending them yet
  if ((chorusFirst && chorus.length > 0) || verses.length === 0) {
    chorus.forEach((line, index) => {
      let div = document.createElement("div");
      div.classList.add("chorus", "slide");
      let content = replaceLineBreaks(line);
      div.innerHTML = content;

      // Add next slide starting line to previous slide (starting from second slide)
      if (index > 0) {
        addNextSlideStartingLine(content);
      }

      slides.push(div);
    });
  }

  if (verses.length > 0) {
    let currentVerse;
    verses.forEach((verse, verseIndex) => {
      currentVerse = verseIndex + 1;
      verse.forEach((line, lineIndex) => {
        let verseNumber = lineIndex === 0 ? verseIndex + 1 : "";
        let arabicNumber = verseNumber
          ? new Intl.NumberFormat("ar-EG").format(verseNumber)
          : "";

        let div = document.createElement("div");
        div.classList.add("verse", "slide");
        div.dataset.verseNumber = verseNumber;
        let content = `<span class="verseNumber">${arabicNumber}</span><div>${replaceLineBreaks(
          line
        )}</div>`;
        div.innerHTML = content;

        // Add next slide starting line to previous slide (starting from second slide)
        if (slides.length > 0) {
          addNextSlideStartingLine(content);
        }

        // add verse info
        div.innerHTML += `
        <div class="singers-verse-info">
        <span class="total-verse">${verses.length}/</span>
        <span class="current-verse">${currentVerse}</span>
        </div>
        `;

        slides.push(div);
      });

      if (chorus && chorus.length > 0) {
        chorus.forEach((chorusLine, chorusIndex) => {
          let chorusSymbol = chorusIndex === 0 ? "ق" : "";

          let div = document.createElement("div");
          div.classList.add("chorus", "slide");
          div.dataset.verseNumber = verseIndex + 1;
          let content = `<span class="chorusSymbol">${chorusSymbol}</span> ${replaceLineBreaks(
            chorusLine
          )}`;
          div.innerHTML = content;

          // Add next slide starting line to previous slide
          if (slides.length > 0) {
            addNextSlideStartingLine(content);
          }

          // add verse info
          div.innerHTML += `
        <div class="singers-verse-info">
        <span class="total-verse">${verses.length}/</span>
          <span class="current-verse">${currentVerse}</span>
        </div>
        `;

          slides.push(div);
        });
      }
    });
  }

  // create empty div
  let emptySlide = document.createElement("div");
  emptySlide.classList.add("verse", "slide");
  let emptyContent = `<span class="verseNumber"></span><div></div>`;
  emptySlide.innerHTML = emptyContent;

  // Add next slide starting line to previous slide
  if (slides.length > 0) {
    addNextSlideStartingLine(emptyContent);
  }

  slides.push(emptySlide);

  // Animate slides one by one
  slides.forEach((slide, index) => {
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";
    container.appendChild(slide); // Append to DOM first

    let time = 100 / (index + 1);
    setTimeout(() => {
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, time);
  });
}
