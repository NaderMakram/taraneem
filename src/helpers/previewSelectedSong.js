export function previewSelectedChapter(
  { chapter_name, chapter_book, chapter_number, verses },
  refIndex
) {
  let chapter_number_ar = new Intl.NumberFormat("ar-EG").format(chapter_number);

  let html = `<h4 class="song-title" data-ref="${refIndex}">${
    chapter_book + "  " + chapter_number_ar
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
  { title, chorus, verses, chorusFirst },
  refIndex
) {
  let html = `<h4 class="song-title" data-ref="${refIndex}">${title}</h4>`;
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
