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
export function highlightMatch(text, term) {
  if (!text || !term) return text;

  // Step A: Normalize
  // Ensure your normalize function doesn't strip spaces between words
  const normalizedTerm = normalize(term.trim()); 
  if (!normalizedTerm) return text;

  // Step B: Build Pattern
  const fuzzyPattern = normalizedTerm
    .split("")
    .map((char) => {
      switch (char) {
        // --- NEW FIX: Handle Spaces ---
        case " ":
          // Match any whitespace, including \n (newlines)
          return "[\\s]+";

        // --- Existing Arabic Normalization ---
        case "ا":
          return "[اأآإ]"; 
        case "ي":
          return "[يى]"; 
        case "س":
          return "[سث]"; 
        case "ك":
          return "[كق]"; 
        case "ة":
          return "[ةه]"; 
        case "ز":
          return "[زذظ]"; 
        case "ء":
          return "[ءؤئ]";

        default:
          // Escape special regex chars
          return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    })
    // Join allows Tashkeel/Tatweel between characters (and between the space and next letter)
    .join("[\\u064B-\\u065F~ـٰ]*");

  try {
    // Step C: Apply Regex
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
export function generate_item_html(element, term, truncateLimit = 100, isWaitingList = false) {

  // Helper to generate the Handle (only for Waiting List)
  const handleHTML = isWaitingList ? '<span class="handle"></span>' : '';

  // Helper to generate the Action Button (Plus for search, Minus/Delete for Waiting List)
  const actionButtonHTML = isWaitingList
    ? '<img src="./img/minus-64.png" class="delete hide" alt="delete"/>'
    : '<img src="./img/plus.svg" class="plus hide" alt="plus"/>';

  // Helper for Data Attributes
  const waitingIdAttr = isWaitingList && element.waiting_id ? `data-id="${element.waiting_id}"` : '';

  // --- SONG LOGIC ---
  if (element.custom_ref.includes("song")) {
    let { title, chorus, verses, matchLocation, chorusFirst } = element;

    let displayTitle = title;
    let displayBody = ""; 
    let badge = ""; 

    if (matchLocation && term) {

    // 1. MATCH IN TITLE
      if (matchLocation.section === 'title') {
        badge = "";

        // Logic: If waiting list, do NOT highlight title. Else, highlight.
        displayTitle = isWaitingList ? title : highlightMatch(title, term);

        // Body context logic based on chorusFirst
        // If chorusFirst is true (or undefined/default), try Chorus -> Verse
        // If chorusFirst is explicitly false, try Verse -> Chorus

        if (!chorusFirst || chorusFirst === false) {
          // Verse First
          if (verses && verses.length > 0 && verses[0].length > 0) {
            displayBody = truncate(verses[0][0], truncateLimit);
          } else if (chorus && chorus.length > 0) {
            displayBody = truncate(chorus[0], truncateLimit);
          }
        }
        else {
          // Default: Chorus First
          if (chorus && chorus.length > 0) {
            displayBody = truncate(chorus[0], truncateLimit);
          } else if (verses && verses.length > 0 && verses[0].length > 0) {
            displayBody = truncate(verses[0][0], truncateLimit);
          }
        } 
      }

        // 2. MATCH IN CHORUS
      else if (matchLocation.section === 'chorus') {
        badge = "(ق)"; 
        let originalLine = chorus[matchLocation.slideIndex];
        let isFirstSlide = (matchLocation.slideIndex === 0);

        if (isWaitingList && isFirstSlide) {
          displayBody = truncate(originalLine, truncateLimit);
        } else {
          displayBody = highlightMatch(originalLine, term);
        }
      }

        // 3. MATCH IN VERSE
      else if (matchLocation.section === 'verse') {
        badge = `${matchLocation.verseIndex + 1}-`; 
        let originalLine = verses[matchLocation.verseIndex][matchLocation.slideIndex];
        let isFirstSlide = (matchLocation.verseIndex === 0 && matchLocation.slideIndex === 0);

        if (isWaitingList && isFirstSlide) {
          displayBody = truncate(originalLine, truncateLimit);
        } else {
          displayBody = highlightMatch(originalLine, term);
        }
      }

    } else {
      // Fallback (No match location or no term)
      // We apply the same chorusFirst logic here for consistency
      if (chorusFirst !== false) {
        if (chorus && chorus.length) {
          badge = "(ق)";
          displayBody = truncate(chorus[0], truncateLimit);
        } else if (verses && verses.length) {
          badge = "1-";
          displayBody = truncate(verses[0][0], truncateLimit);
        }
      } else {
        if (verses && verses.length) {
          badge = "1-";
          displayBody = truncate(verses[0][0], truncateLimit);
        } else if (chorus && chorus.length) {
          badge = "(ق)";
          displayBody = truncate(chorus[0], truncateLimit);
        }
      }
    }

    return `
      <div class="big song" data-ref="${element.custom_ref}" ${waitingIdAttr}>
        ${handleHTML}
        <div class="box-head">
            <img src="./img/song-icon.png" class="title-logo"/>
            <h2>${displayTitle}</h2>
        </div>
        <div class="verses" style="direction: rtl;">
            <span style="font-weight:bold; margin-left:5px; color:#555;">${badge}</span>
            ${displayBody}
        </div>
        ${actionButtonHTML}
      </div>
    `;
  } 
  
    // --- BIBLE LOGIC ---
  else {
    let { chapter_book_short, chapter_book, chapter, verse, verses, custom_ref, chapter_name, chapter_number } = element;

    // Search Mode Filtering Logic
    if (!isWaitingList) {
      term = term ? term.trim() : "";

      let bookNumberMatch = term.match(/^(\d+)(?=\D)/);
      let searched_book_series = bookNumberMatch ? bookNumberMatch[1] : null;
      if (searched_book_series) term = term.replace(/^\d+/, ""); 

      let match = term.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);
      let searched_chapter = match ? match[1] : null;
      let searched_verse = (match && match[2]) ? match[2] : null;

      let book_series = (chapter_book_short.match(/\d+/) || [null])[0];

      if (searched_book_series && searched_book_series != book_series) return "";

      if (searched_chapter) {
        if (!searched_chapter || chapter_number != searched_chapter || (searched_verse && !verses[searched_verse])) {
          return "";
        }
        chapter = searched_chapter;
        verse = searched_verse;
      }
    }

    // HTML Generation
    let titleHTML;
    let versesHTML;
    let bodyText = "";

    if (verse) {
      // Specific Verse Case
      titleHTML = `<h2>${chapter_name} : ${verse}</h2>`;
      bodyText = verses[verse];
    } else {
      // Whole Chapter / Default Case
      titleHTML = `<h2>${chapter_name}</h2>`;
      // Create preview (Verse 1 + Verse 2)
      let rawText = (verses["1"] || "");
      bodyText = truncate(rawText, 100);
    }

    // --- HIGHLIGHT LOGIC ---
    // If we are in Search Mode (!isWaitingList), apply the highlight.
    // If we are in Waiting List, show plain text.
    let displayBody = isWaitingList ? bodyText : highlightMatch(bodyText, term);

    versesHTML = `<div class="verses">${displayBody}</div>`;

    return `
      <div class="big chapter" data-ref="${custom_ref}" data-verse="${verse || ""}" ${waitingIdAttr} dir="rtl">
        ${handleHTML}
        <div class="box-head">
          <img src="./img/bible-icon.png" class="title-logo"/>
          ${titleHTML}
        </div>
        ${versesHTML}
        ${actionButtonHTML}
      </div>
    `;
  }
}
