export function previewSelectedChapter(
  { chapter_name, chapter_en, chapter_book, chapter_number, verses, siblings, prevShort, prevNum, nextShort, nextNum },
  refIndex
) {
  let chapter_number_ar = new Intl.NumberFormat("ar-EG").format(chapter_number);

  const prevChapterBtn = document.querySelector("#prevChapter");
  const nextChapterBtn = document.querySelector("#nextChapter");

  prevChapterBtn.setAttribute("data-chapterIndex", siblings[0]);
  nextChapterBtn.setAttribute("data-chapterIndex", siblings[1]);

  prevChapterBtn.innerHTML = `${prevShort}<br/>${prevNum}`
  nextChapterBtn.innerHTML = `${nextShort}<br/>${nextNum}`

  // window.myCustomAPI.getSiblingChapters(siblings)
  // console.log(siblings)

  let html = `<h4 class="song-title" data-ref="${refIndex}">${chapter_book + "  " + chapter_number_ar + "    |    " + chapter_en
    }</h4>`;
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

  html += `</div>`;
  return html;
}

// preview selected song
export function previewSelectedSong(
  { title, chorus, verses, chorusFirst, scale },
  refIndex
) {
  let html = `<h4 class="song-title" data-ref="${refIndex}">${title}</h4>`;
  html += `<h5 class="song-info">scale: ${scale ? scale : "??"}</h5>`;
  html += `<div class="song-preview">`;
  const replaceLineBreaks = (text) => text.replace(/\n/g, "<br>");

  if ((chorusFirst && chorus && chorus.length > 0) || verses.length == 0) {
    chorus.forEach((line) => {
      html += `<div class="chorus slide">${replaceLineBreaks(line)}</div>`;
    });
  }

  if (verses && verses.length > 0) {
    for (let verseIndex = 0; verseIndex < verses.length; verseIndex++) {
      const verse = verses[verseIndex];

      for (let lineIndex = 0; lineIndex < verse.length; lineIndex++) {
        const line = verse[lineIndex];

        // add verse number for the first line in a verse
        let verseNumber = "";
        let arabicNumber = "";
        if (lineIndex == 0) {
          verseNumber = verseIndex + 1;
          arabicNumber = new Intl.NumberFormat("ar-EG").format(verseNumber);
        }
        html += `<div class="verse slide" data-verseNumber="${verseNumber}">
            <span class="verseNumber">${arabicNumber}</span>
            <div>
            ${replaceLineBreaks(line)}
            </div>
            </div>`;
      }

      if (chorus && chorus.length > 0) {
        for (let chorusIndex = 0; chorusIndex < chorus.length; chorusIndex++) {
          const chorusLine = chorus[chorusIndex];
          let chorusSymbol = "";
          if (chorusIndex == 0) {
            chorusSymbol = "ق";
          }
          html += `<div class="chorus slide">
            <span class="chorusSymbol">${chorusSymbol}</span>
            ${replaceLineBreaks(chorusLine)}
            </div>`;
        }
      }
    }
  }

  html += `<div class="chorus slide"></div>`;

  html += `</div>`;
  return html;
}
