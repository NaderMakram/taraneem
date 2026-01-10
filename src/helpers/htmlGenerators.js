// 1. Your Custom Normalization Function (Keep this available)
function normalize(text) {
  return (
    text
      .replace(/أ|آ|إ/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ث/g, "س")
      .replace(/ق/g, "ك")
      .replace(/ه/g, "ة")
      .replace(/ذ|ظ/g, "ز")
      .replace(/ؤ|ئ/g, "ء")
      // remove tashkeel
      .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
      // remove \n
      .replace(/\n/g, " ")
  );
}

// 2. The Smart Highlighter
function highlightMatch(text, term) {
  if (!text || !term) return text;

  // Step A: Normalize the search term first so we have a consistent base
  const normalizedTerm = normalize(term.trim());
  if (!normalizedTerm) return text;

  // Step B: Build a "Reverse" Regex pattern
  // We iterate through the NORMALIZED term and create a pattern that looks for
  // ANY of the characters that could have produced that normalized character.
  const fuzzyPattern = normalizedTerm
    .split("")
    .map((char) => {
      // Map back to all possible original characters based on your rules
      switch (char) {
        case "ا":
          return "[اأآإ]"; // normalized from أ, آ, إ
        case "ي":
          return "[يى]"; // normalized from ى
        case "س":
          return "[سث]"; // normalized from ث
        case "ك":
          return "[كق]"; // normalized from ق
        case "ة":
          return "[ةه]"; // normalized from ه
        case "ز":
          return "[زذظ]"; // normalized from ذ, ظ
        case "ء":
          return "[ءؤئ]"; // normalized from ؤ, ئ
        default:
          // Escape special regex chars just in case (like ?, *, +)
          return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    })
    // Allow optional Tashkeel (diacritics), Tatweel (ـ), and superscript Alef (ٰ) between characters
    .join("[\\u064B-\\u065F~ـٰ]*");

  try {
    // Step C: Apply the regex to the ORIGINAL text
    const regex = new RegExp(`(${fuzzyPattern})`, "gi");
    return text.replace(
      regex,
      '<span class="text-highlight">$1</span>'
    );
  } catch (e) {
    console.error("Regex error:", e);
    return text;
  }
}

function truncate(str, max_length) {
  if (!str) return "";
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}

export function generate_item_html(element, term, truncateLimit = 50) {


  if (element.custom_ref.includes("song")) {
    let { title, chorus, verses, matchLocation } = element;
    
    // Default display values
    let displayTitle = title; // Use ORIGINAL title
    let displayBody = ""; 
    let badge = "";       

    // FIX 2: Use matchLocation INDICES to get the ORIGINAL text
    if (matchLocation) {
      if (matchLocation.section === 'title') {
        // Highlight the Title
        displayTitle = highlightMatch(title, term);
        badge = "(العنوان)";
        // Context: First line of chorus or verse
        if (chorus && chorus.length > 0) {
          displayBody = truncate(chorus[0], truncateLimit);
        } else if (verses && verses.length > 0 && verses[0].length > 0) {
          displayBody = truncate(verses[0][0], truncateLimit);
        }
      } 
      else if (matchLocation.section === 'chorus') {
        badge = "(ق)"; 
        // Get ORIGINAL text using the index
        let originalLine = chorus[matchLocation.slideIndex];
        displayBody = highlightMatch(originalLine, term);
      } 
      else if (matchLocation.section === 'verse') {
        badge = `${matchLocation.verseIndex + 1}-`; 
        // Get ORIGINAL text using the indices
        // verses is array of verses, each verse is array of lines
        let originalLine = verses[matchLocation.verseIndex][matchLocation.slideIndex];
        displayBody = highlightMatch(originalLine, term);
      }
    } else {
      // Fallback
      if (chorus && chorus.length) {
        badge = "(ق)";
        displayBody = truncate(chorus[0], truncateLimit);
      } else if (verses && verses.length) {
        badge = "1-";
        displayBody = truncate(verses[0][0], truncateLimit);
      }
    }

    return `
      <div class="big song" data-ref="${element.custom_ref}">
        <div class="box-head">
            <img src="./img/song-icon.png" class="title-logo"/>
            <h2>${displayTitle}</h2>
        </div>
        <div class="verses" style="direction: rtl;">
            <span style="font-weight:bold; margin-left:5px; color:#555;">${badge}</span>
            ${displayBody}
        </div>
        <img src="./img/plus.svg" class="plus hide" alt="plus"/>
      </div>
    `;
  } 
  
  // --- BIBLE LOGIC (Unchanged) ---
  else {
    // ... (Keep your existing Bible logic here) ...
    // Note: I omitted it for brevity, but make sure to include the Bible `else` block from the previous code.
     term = term.trim();

    // Capture leading number (book number) if it exists
    let bookNumberMatch = term.match(/^(\d+)(?=\D)/); 
    let searched_book_series = bookNumberMatch ? bookNumberMatch[1] : null;

    // Remove the book number (if found) from the term
    if (searched_book_series) {
      term = term.replace(/^\d+/, ""); 
    }

    // Match chapter and verse
    let match = term.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);

    let searched_chapter;
    let searched_verse;
    if (match) {
      searched_chapter = match[1];
      searched_verse = match[2] || null;
    }

    let { chapter_book_short, chapter_book, chapter, verse, verses, custom_ref, chapter_name, chapter_number } = element;
    let book_series = (chapter_book_short.match(/\d+/) || [null])[0];

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