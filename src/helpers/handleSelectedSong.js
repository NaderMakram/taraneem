import { generate_item_html } from "./htmlGenerators.js";
import {
  previewSelectedSong,
  previewSelectedChapter,
} from "./previewSelectedSong.js";
import { newSlide } from "./newSlide.js";
import { displayWaitingList } from "./displayWaitingList.js";
const fontSizeInput = document.querySelector("#fontSize");
const fontSizePlus = document.querySelector("#fontSizePlus");
const fontSizeMinus = document.querySelector("#fontSizeMinus");
const siblingChaptersBtns = document.querySelector("#siblingChaptersBtns");
// const fs = require("fs");

let sortableOptions = {
  handle: ".handle",
  animation: 220,
  ghostClass: "sortable-ghost",
  swapThreshold: 1,
  forceFallback: true,
  scroll: true,
  forceAutoScrollFallback: true,
  scrollSensitivity: 100,
  scrollSpeed: 10,
  bubbleScroll: false,
  onEnd: (e) => {
    array_move(waiting, e.oldIndex, e.newIndex);
  },
};

myCustomAPI.createSortable(
  document.querySelector("#waiting_output"),
  sortableOptions
);

function array_move(arr, old_index, new_index) {
  if (new_index >= arr.length) {
    return;
  }
  const movedObject = arr.splice(old_index, 1)[0]; // Remove the object at oldIndex and get it
  arr.splice(new_index, 0, movedObject); // Insert the object at newIndex
  displayWaitingList(waiting);
}

let res;
let waiting = [];
let storedWaiting = localStorage.getItem("waiting_list");
// console.log(storedWaiting);
if (storedWaiting && storedWaiting != "undefined") {
  // console.log("local", storedWaiting);
  waiting = JSON.parse(storedWaiting);
  displayWaitingList(waiting);
  // displayWaitingList(waiting)
}
// console.log("waiting", waiting);
let delay = 50;

// ==========================================================
// 1. GLOBAL CACHE (Prevents re-fetching from API)
// ==========================================================
let SEARCH_CACHE = {
  songs: null,
  bible: null,
  chapters: null,
  isReady: false
};

// Call this function ONCE when your app starts (e.g. window.onload)
export async function initSearchEngine() {
  console.time("Search Engine Init");

  // 1. Fetch raw data once
  const rawSongs = await myCustomAPI.getSongs();
  const rawBible = myCustomAPI.getBibleVerses();
  const rawChapters = myCustomAPI.getBibleDBIndexed();

  // 2. Pre-calculate "Searchable Strings" for Songs
  // We flatten the arrays into one string so we can search it instantly.
  SEARCH_CACHE.songs = rawSongs.map((song, index) => {
    const c = song.searchableContent;
    // Join everything into one huge string for "Detection"
    // We use a separator like '|' to avoid accidental matches across lines
    const flatChorus = c.chorus ? c.chorus.join("|") : "";
    const flatVerses = c.verses ? c.verses.flat().join("|") : "";

    return {
      id: index, // Keep track of original index
      // The "Fast String" that makes search instant
      fastText: (c.title + "|" + flatChorus + "|" + flatVerses),
      // Keep original data for the Result Builder
      original: song
    };
  });

  // 3. Store Bible & Chapters directly
  SEARCH_CACHE.bible = rawBible;
  SEARCH_CACHE.chapters = rawChapters;
  SEARCH_CACHE.isReady = true;

  console.timeEnd("Search Engine Init");
}

// ==========================================================
// 2. OPTIMIZED SEARCH (Uses Cache + Fast String Check)
// ==========================================================

// export function searchAndDisplayResults(term) {
//   if (!SEARCH_CACHE.isReady) {
//     console.warn("Search not ready yet. Call initSearchEngine() first.");
//     initSearchEngine(); // Lazy load if forgot
//     return;
//   }

//   console.time("Search Time");

//   const originalTerm = term;
//   const normalizedTerm = normalize(term);
//   const containsDigit = /\d/.test(originalTerm);
//   let results = [];

//   if (containsDigit) {
//     // ... (Your existing Chapter Search Logic using SEARCH_CACHE.chapters) ...
//     // Logic remains the same, just use SEARCH_CACHE.chapters instead of API
//     let termWithoutSpaces = originalTerm.trim().replace(/\s+/g, " ");
//     let book_and_chapter = termWithoutSpaces.replace(/[^\u0600-\u06FF\s]/g, "").trim();

//     if (book_and_chapter) {
//       let normalChapter = normalizeBibleVerse(book_and_chapter);
//       if (normalChapter === "مزمور") normalChapter = "مز";
//       results = searchChaptersOptimized(normalChapter, SEARCH_CACHE.chapters);
//     }
//   } else {
//     // A. SEARCH SONGS (The Super Fast Part)
//     // We filter using the 'fastText' string first (Ultra fast)
//     // Then we calculate specific locations only for matches.

//     const candidates = [];
//     const songList = SEARCH_CACHE.songs; // Use Local Cache
//     const len = songList.length;

//     for (let i = 0; i < len; i++) {
//       // 1. The "Gatekeeper" Check: One single string check
//       // If the word isn't in the big string, SKIP EVERYTHING.
//       if (songList[i].fastText.includes(normalizedTerm)) {

//         // 2. Only if it matches, do the heavy detailed check
//         const detailedMatch = calculateSongScore(songList[i].original, normalizedTerm);
//         if (detailedMatch.score > 0) {
//           candidates.push(detailedMatch);
//         }
//       }
//     }

//     // Sort
//     candidates.sort((a, b) => b.score - a.score);
//     const songResults = candidates.slice(0, 50); // Hydration is already done in calculateSongScore

//     // B. SEARCH BIBLE
//     let bibleResults = [];
//     if (originalTerm.trim().split(/\s+/).length >= 2) {
//       bibleResults = searchBibleOptimized(normalizedTerm, SEARCH_CACHE.bible);
//     }

//     results = [...songResults, ...bibleResults];
//   }

//   console.timeEnd("Search Time");
//   generateHTML(originalTerm, results);
// }

// Helper to do the detailed logic (Verses/Chorus) ONLY on matches
function calculateSongScore(item, term) {
  let { title, chorus, verses } = item.searchableContent;
  let score = 0;

  let matchInTitle = false;
  let matchInChorus = null;
  let matchInVerse = null;

  // We know the term IS inside because fastText check passed.
  // Now we just need to find WHERE.

  // 1. Check Title
  if (title.includes(term)) {
    score += 10;
    matchInTitle = true;
  }

  // 2. Check Chorus
  if (chorus) {
    for (let i = 0; i < chorus.length; i++) {
      if (chorus[i].includes(term)) {
        score += 5;
        if (!matchInChorus) matchInChorus = { lineIndex: i, text: chorus[i] };
        // Optimization: If we found a chorus match and title match, 
        // we might not need to check verses to save time?
        // For now, let's keep checking to get max score.
      }
    }
  }

  // 3. Check Verses
  if (verses) {
    for (let v = 0; v < verses.length; v++) {
      for (let l = 0; l < verses[v].length; l++) {
        if (verses[v][l].includes(term)) {
          score += 2;
          if (!matchInVerse) matchInVerse = { verseIndex: v, lineIndex: l, text: verses[v][l] };
        }
      }
    }
  }

  // Determine UI Locations (Same logic as your worker)
  let matchedKey = null;
  let matchedText = null;
  let matchLocation = null;
  let jumpLocation = null;

  if (matchInTitle) {
    matchedKey = "title";
    matchedText = title;
    matchLocation = { section: "title" };
    if (matchInChorus) jumpLocation = { section: "chorus", slideIndex: matchInChorus.lineIndex };
    else if (matchInVerse) jumpLocation = { section: "verse", verseIndex: matchInVerse.verseIndex, slideIndex: matchInVerse.lineIndex };
  } else if (matchInChorus) {
    matchedKey = "chorus";
    matchedText = matchInChorus.text;
    matchLocation = { section: "chorus", slideIndex: matchInChorus.lineIndex };
    jumpLocation = matchLocation;
  } else if (matchInVerse) {
    matchedKey = "verses";
    matchedText = matchInVerse.text;
    matchLocation = { section: "verse", verseIndex: matchInVerse.verseIndex, slideIndex: matchInVerse.lineIndex };
    jumpLocation = matchLocation;
  }

  return { ...item, score, matchedKey, matchedText, matchLocation, jumpLocation };
}


// ==========================================================
// OPTIMIZED SEARCH FUNCTIONS (Scan -> Sort -> Hydrate)
// ==========================================================

function searchSongsOptimized(term, songs) {
  const candidates = [];
  const len = songs.length;
  // Performance: Only search deep verses if term is 3+ chars
  const deepSearch = term.length >= 3;

  // --- PHASE 1: LIGHT SCAN (No Object Creation) ---
  for (let i = 0; i < len; i++) {
    const item = songs[i];
    const content = item.searchableContent;

    let score = 0;

    // Track match metadata simply using numbers/booleans (Fastest)
    let hasTitleMatch = false;
    let chorusMatchIndex = -1; // -1 means no match
    let verseMatchIdx = -1;    // -1 means no match
    let verseLineMatchIdx = -1;

    // 1. Check Title
    if (content.title.includes(term)) {
      score += 10;
      hasTitleMatch = true;
    }

    // 2. Check Chorus (Array of strings)
    if (content.chorus) {
      const cLen = content.chorus.length;
      for (let j = 0; j < cLen; j++) {
        if (content.chorus[j].includes(term)) {
          score += 5;
          // Capture the FIRST match location for the jump logic
          if (chorusMatchIndex === -1) chorusMatchIndex = j;
        }
      }
    }

    // 3. Check Verses (Array of Arrays) - conditionally
    if (deepSearch && content.verses) {
      const vLen = content.verses.length;
      for (let v = 0; v < vLen; v++) {
        const lines = content.verses[v];
        const lLen = lines.length;
        for (let l = 0; l < lLen; l++) {
          if (lines[l].includes(term)) {
            score += 2;
            // Capture FIRST match location
            if (verseMatchIdx === -1) {
              verseMatchIdx = v;
              verseLineMatchIdx = l;
            }
          }
        }
      }
    }

    // If we found anything, push a LIGHTWEIGHT candidate
    if (score > 0) {
      candidates.push({
        id: i,      // Index in original array
        s: score,   // Score
        mt: hasTitleMatch,    // Match Title (bool)
        mc: chorusMatchIndex, // Match Chorus Index (int)
        mv: verseMatchIdx,    // Match Verse Index (int)
        mvl: verseLineMatchIdx// Match Verse Line Index (int)
      });
    }
  }

  // --- PHASE 2: SORT ---
  candidates.sort((a, b) => b.s - a.s);

  // --- PHASE 3: HYDRATE (Top 50 Only) ---
  return candidates.slice(0, 50).map(cand => {
    const original = songs[cand.id];
    const content = original.searchableContent;

    let matchedKey = null;
    let matchedText = null;
    let matchLocation = null;
    let jumpLocation = null;

    // Reconstruct the logic for UI (Title > Chorus > Verse)

    // Case A: Title Match
    if (cand.mt) {
      matchedKey = "title";
      matchedText = content.title;
      matchLocation = { section: "title" };

      // Determine Jump Location (even if Title matched)
      if (cand.mc !== -1) {
        jumpLocation = { section: "chorus", slideIndex: cand.mc };
      } else if (cand.mv !== -1) {
        jumpLocation = { section: "verse", verseIndex: cand.mv, slideIndex: cand.mvl };
      }
    }
    // Case B: Chorus Match
    else if (cand.mc !== -1) {
      matchedKey = "chorus";
      matchedText = content.chorus[cand.mc];
      matchLocation = { section: "chorus", slideIndex: cand.mc };
      jumpLocation = matchLocation;
    }
    // Case C: Verse Match
    else if (cand.mv !== -1) {
      matchedKey = "verses";
      matchedText = content.verses[cand.mv][cand.mvl];
      matchLocation = { section: "verse", verseIndex: cand.mv, slideIndex: cand.mvl };
      jumpLocation = matchLocation;
    }

    return {
      ...original,
      score: cand.s,
      matchedKey,
      matchedText,
      matchLocation,
      jumpLocation
    };
  });
}

function searchBibleOptimized(term, bibleVerses) {
  const candidates = [];
  const len = bibleVerses.length;

  // Phase 1: Scan
  for (let i = 0; i < len; i++) {
    const verse = bibleVerses[i];
    let index = verse.text.indexOf(term);

    if (index !== -1) {
      candidates.push({
        id: i,
        s: 2, // Fixed score for bible match
        idx: index // Store where the match happened
      });
    }
  }

  // Phase 2: Sort (optional if scores are all equal, but good practice)
  candidates.sort((a, b) => b.s - a.s);

  // Phase 3: Hydrate
  return candidates.slice(0, 50).map(cand => {
    const original = bibleVerses[cand.id];
    return {
      ...original,
      score: cand.s,
      matchedKey: "verses",
      matchedText: original.text.substring(cand.idx, cand.idx + term.length)
    };
  });
}

function searchChaptersOptimized(term, bibleChapters) {
  const candidates = [];
  const len = bibleChapters.length;
  const isLongTerm = term.length >= 3;

  // Phase 1: Scan
  for (let i = 0; i < len; i++) {
    const chapter = bibleChapters[i];
    let score = 0;
    let matchedKey = null;
    let matchIndex = -1;

    // Check Short Name
    let idx = chapter.chapter_book_short.indexOf(term);
    if (idx !== -1) {
      score += 10;
      matchedKey = "chapter_book_short";
      matchIndex = idx;
    }

    // Check Long Name (if term is long enough)
    if (isLongTerm) {
      idx = chapter.chapter_book_normalized.indexOf(term);
      if (idx !== -1) {
        score += 5;
        // Only overwrite if we haven't found a match yet (or prioritize short?)
        // Your original logic prioritized short (kept first match), so:
        if (!matchedKey) {
          matchedKey = "chapter_book_normalized";
          matchIndex = idx;
        }
      }
    }

    if (score > 0) {
      candidates.push({
        id: i,
        s: score,
        k: matchedKey,
        idx: matchIndex
      });
    }
  }

  // Phase 2: Sort
  candidates.sort((a, b) => b.s - a.s);

  // Phase 3: Hydrate
  return candidates.slice(0, 50).map(cand => {
    const original = bibleChapters[cand.id];
    let textSource = (cand.k === "chapter_book_short")
      ? original.chapter_book_short
      : original.chapter_book_normalized;

    return {
      ...original,
      score: cand.s,
      matchedKey: cand.k,
      matchedText: textSource.substring(cand.idx, cand.idx + term.length)
    };
  });
}


// ==========================================================
// UTILITIES (Keep these as they were)
// ==========================================================

// function normalize(text) {
//   return text
//     .replace(/أ|آ|إ/g, "ا")
//     .replace(/ى/g, "ي")
//     .replace(/ث/g, "س")
//     .replace(/ق/g, "ك")
//     .replace(/ه/g, "ة")
//     .replace(/ذ|ظ/g, "ز")
//     .replace(/ؤ|ئ/g, "ء")
//     .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
//     .replace(/\n/g, " ");
// }

function normalizeBibleVerse(text) {
  return text
    .replace(/أ|آ|إ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ه/g, "ة")
    .replace(/[؟!،.]/g, "");
}



// Helper: Smart Fuzzy Highlight for Arabic
function highlightMatch(text, term) {
  if (!text || !term) return text;
  
  // 1. Build a "Fuzzy" Regex Pattern
  // This maps common variations so "alf" matches "alf with hamza", etc.
  let safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  let fuzzyPattern = safeTerm.split('').map(char => {
    // Match any form of Alef
    if (/[اأإآ]/.test(char)) return '[اأإآ]';
    // Match Ya or Alif Maqsura
    if (/[يى]/.test(char)) return '[يى]';
    // Match Ha or Taa Marbuta
    if (/[هة]/.test(char)) return '[هة]';
    // Allow for existing Regex chars or English text
    return char; 
  }).join('[\\u064B-\\u065F]*'); // Allow optional Arabic diacritics (Tashkeel) between chars

  try {
    // Create regex: Global, Case-insensitive
    const regex = new RegExp(`(${fuzzyPattern})`, 'gi');
    return text.replace(regex, '<span class="text-highlight" style="background-color: #f1c40f; color: #000; border-radius: 3px;">$1</span>');
  } catch (e) {
    console.error("Regex error", e);
    return text;
  }
}

export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Use debounce to delay the search function
// export let debouncedSearch = debounce(searchAndDisplayResults, delay);

let toggleFontSizeInput = (isBible) => {
  if (isBible) {
    // show sibling chapter buttons
    siblingChaptersBtns.style.display = "flex";
    // Disable the input field
    fontSizeInput.disabled = true;
    fontSizePlus.disabled = true;
    fontSizeMinus.disabled = true;

    // Change cursor style to not-allowed
    fontSizeInput.style.cursor = "not-allowed";
    fontSizePlus.style.cursor = "not-allowed";
    fontSizeMinus.style.cursor = "not-allowed";

    // Adjust opacity to visually indicate disabled state
    fontSizeInput.style.opacity = "0.3";
    fontSizePlus.style.opacity = "0.3";
    fontSizeMinus.style.opacity = "0.3";

    // remove hover effect from buttons
    fontSizePlus.classList.remove("hover-bg");
    fontSizeMinus.classList.remove("hover-bg");
  } else {
    // hide sibling chapter buttons
    siblingChaptersBtns.style.display = "none";

    // Enable the input field
    fontSizeInput.disabled = false;
    fontSizePlus.disabled = false;
    fontSizeMinus.disabled = false;

    // Reset cursor style
    fontSizeInput.style.cursor = "pointer";
    fontSizePlus.style.cursor = "pointer";
    fontSizeMinus.style.cursor = "pointer";

    // Reset opacity
    fontSizeInput.style.opacity = "1";
    fontSizePlus.style.opacity = "1";
    fontSizeMinus.style.opacity = "1";

    // reset hover effect from buttons
    fontSizePlus.classList.add("hover-bg");
    fontSizeMinus.classList.add("hover-bg");
  }
};

let createAddedFeedback = (container, feedbackClass) => {
  const feedbackIcon = document.createElement("div");
  feedbackIcon.classList.add(feedbackClass);

  // Set feedbackIcon position to match container
  feedbackIcon.style.position = "absolute"; // Make feedbackIcon position relative to container
  feedbackIcon.style.top = "-15px";
  feedbackIcon.style.left = "6px";

  container.appendChild(feedbackIcon);

  // Rest of your code for animation and removal remains the same
  requestAnimationFrame(() => {
    feedbackIcon.style.transform = "translateY(-50px)";
    feedbackIcon.style.opacity = "0";
  });

  setTimeout(() => {
    container.removeChild(feedbackIcon);
  }, 1000);
};

export function selectSongEventFunction(e) {
  if (e.target.classList.contains("handle")) return;

  let clickedSong = e.target.closest(".song");
  let clickedChapter = e.target.closest(".chapter");
  let clickedPlus = e.target.classList.contains("plus");
  let clickedDelete = e.target.classList.contains("delete");

  // --- DELETE LOGIC (Unchanged) ---
  if (clickedDelete) {
    let clickedId = e.target.parentNode.getAttribute("data-id");
    waiting = waiting.filter((item) => item.waiting_id != clickedId);
    let deletedDiv = document.querySelector(`#waiting_output div[data-id="${clickedId}"]`);
    if (deletedDiv) deletedDiv.parentNode.removeChild(deletedDiv);
    displayWaitingList(waiting);
    return;
  }

  // --- ADD TO WAITING LIST (Unchanged) ---
  if (clickedPlus) {
    let ref;
    let verse;
    if (clickedSong) {
      ref = clickedSong.getAttribute("data-ref");
    } else {
      ref = clickedChapter.getAttribute("data-ref");
      verse = clickedChapter.getAttribute("data-verse");
    }
    let foundItem = window.res.find((song) => song.custom_ref == ref);
    waiting.push({
      ...foundItem,
      waiting_id: Math.floor(Math.random() * (99999999 - 99) + 99),
      ...(verse !== undefined && { verse }),
      ...(verse !== undefined && { custom_ref: ref }),
      matched_phrase: document.querySelector('#title-input').value
    });
    createAddedFeedback(clickedSong ? clickedSong : clickedChapter, "yellowCheck");
    displayWaitingList(waiting);
    return;
  }

  // --- SONG SELECTION LOGIC ---
  if (clickedSong) {
    toggleFontSizeInput(false);
    
    let ref = clickedSong.getAttribute("data-ref");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = currentSong ? currentSong.getAttribute("data-ref") : 0;

    // Remove red border from all
    const elements = document.querySelectorAll(".big");
    elements.forEach(el => el.classList.remove("selectedSong"));

    if (!clickedPlus) {
      clickedSong.classList.add("selectedSong");
    }

    // == CHECK IF SONG IS ALREADY IN PREVIEW ==
    if (ref && currentSongRef && ref == currentSongRef) {
      
      // -- SECOND CLICK: GO LIVE -- 
      
      let targetedSong = null;
      if (clickedSong.parentNode.parentNode.id == "search_output") {
        // song is from direct search
        targetedSong = window.res.find((song) => song.custom_ref == ref);

        // 1. Get the search term
        let inputVal = document.querySelector("#title-input").value;
      let term = normalize(inputVal).trim(); // Normalize the search term

      // 2. Determine which slide to activate
      let targetSlide = document.querySelector(".slide"); // Default to first slide
      let allSlides = document.querySelectorAll("#preview_output .slide");
      
      if (targetedSong && targetedSong.jumpLocation && term.length > 0) {


        for (let i = 0; i < allSlides.length; i++) {
          let slide = allSlides[i];
          let slideText = normalize(slide.innerText); // Normalize slide text

          if (slideText.includes(term)) {
            targetSlide = slide;
            break; // Stop at the first valid match
          }
        }
      }

      // 3. Activate and Go Live
      if (targetSlide) {
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        targetSlide.classList.add("active");
        newSlide(targetSlide.innerHTML);
      }
      return;

      } else if (clickedSong.parentNode.id == "waiting_output") {
        // song is from waiting list
        let clickedId = e.target.closest(".song").getAttribute("data-id");

        targetedSong = waiting.find((song) => song.waiting_id == clickedId);
        console.log("clicked id: ", clickedId);
        console.log("waiting", waiting);
        let matched_phrase = targetedSong.matched_phrase;
        console.log("matched_phrase", matched_phrase);
        if (matched_phrase) {

          // jump to that slide

          // 2. Determine which slide to activate
          let targetSlide = document.querySelector(".slide"); // Default to first slide
          let allSlides = document.querySelectorAll("#preview_output .slide");


          let normalized_matched_phrase = normalize(matched_phrase)
          for (let i = 0; i < allSlides.length; i++) {
            let slide = allSlides[i];
            let slideText = normalize(slide.innerText); // Normalize slide text

            console.log("slideText", slideText);
            if (slideText.includes(normalized_matched_phrase)) {
              console.log(slide)
              targetSlide = slide;
              break; // Stop at the first valid match
            }
          }


          // 3. Activate and Go Live
          if (targetSlide) {
            if (document.querySelector(".active")) {
              document.querySelector(".active").classList.remove("active");
            }
            targetSlide.classList.add("active");
            newSlide(targetSlide.innerHTML);
          }
          return;
        }
      }



    } else {
      
      // -- FIRST CLICK: LOAD PREVIEW ONLY --
      
      let targetedSong = null;
      if (clickedSong.parentNode.parentNode.id == "search_output") {
        targetedSong = window.res.find((song) => song.custom_ref == ref);
      } else if (clickedSong.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }
      
      if (!clickedPlus) {
        previewSelectedSong(targetedSong);
        newSlide(""); 
      }
    }
  } 
  
  // --- BIBLE LOGIC (Unchanged) ---
  else if (clickedChapter) {
     // ... (Your existing Bible logic here) ...
    toggleFontSizeInput(true);
    let ref = clickedChapter.getAttribute("data-ref");
    let verse = clickedChapter.getAttribute("data-verse");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = currentSong ? currentSong.getAttribute("data-ref") : 0;

    const elements = document.querySelectorAll(".big");
    if (!clickedPlus) {
      elements.forEach(el => el.classList.remove("selectedSong"));
    }
    clickedChapter.classList.add("selectedSong");

    if (ref && currentSongRef && ref == currentSongRef) {
      let targetSlide = document.querySelector(
        `.slide[data-verse-number="${verse ? verse : "1"}"]`
      );
      if (targetSlide) {
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        targetSlide.classList.add("active");
        newSlide(targetSlide.innerHTML);
      }
      return;
    } else {
      let targetedSong;
      if (clickedChapter.parentNode.parentNode.id == "search_output") {
        targetedSong = window.res.find((song) => song.custom_ref == ref);
      } else if (clickedChapter.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }
      if (!clickedPlus) {
        previewSelectedChapter(targetedSong);
        newSlide("");
      }
    }
  }
}

// Add this helper if it's not already imported
function normalize(text) {
  if (!text) return "";
  return (
    text
      .replace(/أ|آ|إ/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ث/g, "س")
      .replace(/ق/g, "ك")
      .replace(/ه/g, "ة")
      .replace(/ذ|ظ/g, "ز")
      .replace(/ؤ|ئ/g, "ء")
      .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
      .replace(/\n/g, " ")
  );
}