function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}
export function generate_item_html(element, term, truncateLimit = 50) {
  // console.log(element);
  let {
    title,
    chorus,
    custom_ref,
    type,
    chapter_number,
    verses,
    chapter_book_short,
    chapter_book,
    chapter,
    verse,
  } = element;

  if (custom_ref.includes("song")) {
    let titleHTML = title ? `<h2>${title}</h2>` : "";

    // Generate HTML for chorus if it exists
    let chorusHTML = chorus
      ? `<div class="chorus">(ق) ${truncate(
          chorus.map((line) => `${line}`).join(""),
          50
        )}</div>`
      : "";

    // Generate HTML for verses if they exist
    let versesHTML = verses
      ? `<div class="verses">1- ${
          verses[0] && typeof verses[0][0] == "string"
            ? truncate(verses[0][0], truncateLimit)
            : ""
        }</div>`
      : "";

    // Combine everything into a single HTML block
    return `
        <div class="big song" data-ref="${custom_ref}">
        <div class="box-head">
                    <img src="./img/song-icon.png" class="title-logo"/>
                    ${titleHTML}
        </div>
          ${chorusHTML}
          ${versesHTML}
          <img src="./img/plus.svg" class="plus hide" alt="plus"/>
        </div>
      `;
  } else {
    term = term.trim();

    // Capture leading number (book number) if it exists
    let bookNumberMatch = term.match(/^(\d+)(?=\D)/); // Capture leading number only if followed by non-digit
    let searched_book_series = bookNumberMatch ? bookNumberMatch[1] : null;

    console.log(`book number: ${bookNumberMatch}`);
    // Remove the book number (if found) from the term
    if (searched_book_series) {
      term = term.replace(/^\d+/, ""); // Remove the number without requiring a space
    }

    // Match chapter and verse
    let match = term.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);

    let searched_chapter;
    let searched_verse;
    if (match) {
      searched_chapter = match[1];
      searched_verse = match[2] || null;
    } else {
      console.log("No chapter/verse match found");
    }

    // Debug Output
    // console.log("searched book series:", searched_book_series);
    // console.log("Chapter:", searched_chapter);
    // console.log("Verse:", searched_verse);

    let book_series = (chapter_book_short.match(/\d+/) || [null])[0];
    let { chapter_name, chapter_number, verse, verses, custom_ref, score } =
      element;
    // console.log(`book series: ${book_series}`);
    // console.log(searched_numbers)
    if (searched_book_series && searched_book_series != book_series) {
      return "";
    }
    if (searched_chapter) {
      if (
        !searched_chapter ||
        chapter_number != searched_chapter ||
        (searched_verse && !verses[searched_verse])
      ) {
        return "";
      } else {
        let titleHTML = chapter_name
          ? `<h2>${chapter_name} ${
              searched_verse ? `: ${searched_verse}` : ""
            }</h2>`
          : "<h2>default title</h2>";

        let versesHTML = searched_verse
          ? `<div class="verses">${verses[searched_verse]}</div>`
          : `<div class="verses">1- ${
              verses["1"] + "2- " + verses["2"] + " ..."
            }</div>`;

        return `
          <div class="big chapter" data-ref="${custom_ref}" data-verse="${
          searched_verse ? searched_verse : ""
        }" dir="rtl">
                    <div class="box-head">
                    <img src="./img/bible-icon.png" class="title-logo"/>
                    ${titleHTML}
                    </div>
            ${versesHTML}
            <img src="./img/plus.svg" class="plus hide" alt="plus"/>
          </div>
          `;
      }
    } else {
      // if there is no searched chapter, it's a single verse
      return `
          <div class="big chapter" data-ref="${custom_ref}" data-verse="${
        verse ? verse : ""
      }" dir="rtl">
            <div class="box-head">
            <img src="./img/bible-icon.png" class="title-logo"/>
            <h2>
            ${chapter_book}
            ${chapter}
            :
            ${verse}
            </h2>
            </div>
            <div class="verses">
            ${verses[element.verse]}
            </div>
            <img src="./img/plus.svg" class="plus hide" alt="plus"/>
          </div>
          `;
    }
  }
}
