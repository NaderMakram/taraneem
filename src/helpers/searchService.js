import { generate_item_html } from "../helpers/htmlGenerators.js"; // Adjust path if needed
import {
  containsSupportedDigit,
  findSingleChapterBookShorts,
  getReferenceInterpretations,
  interpretationMatchesChapter,
  parseBibleReferenceQuery,
} from "./bibleSearchUtils.mjs";

// ==========================================================
// 1. GLOBAL CACHE
// ==========================================================
const SEARCH_CACHE = {
  songs: null,
  bible: null,
  chapters: null,
  singleChapterBookShorts: new Set(),
  isReady: false
};

// This function loads data from Preload -> Renderer
// We make it accessible to window so addNewSong.js can call it easily
window.refreshSearchCache = initSearchEngine;

export async function initSearchEngine() {
  console.time("Search Engine Init");

  try {
    // 1. Fetch raw data (Expensive IPC call - done ONCE)
    const rawSongs = await window.myCustomAPI.getSongs();
    const rawBible = window.myCustomAPI.getBibleVerses();
    const rawChapters = window.myCustomAPI.getBibleDBIndexed();

    // 2. Pre-calculate "Searchable Strings" for Songs
    // This creates the "Fast Index"
    SEARCH_CACHE.songs = rawSongs.map((song, index) => {
      const c = song.searchableContent;
      // Flatten everything into one string for instant detection
      const flatChorus = c.chorus ? c.chorus.join("|") : "";
      const flatVerses = c.verses ? c.verses.flat().join("|") : "";

      return {
        id: index, // Original index
        // The "Fast String": Title + Chorus + Verses
        fastText: (c.title + "|" + flatChorus + "|" + flatVerses),
        original: song
      };
    });

    // 3. Store Bible Data
    SEARCH_CACHE.bible = rawBible;
    SEARCH_CACHE.chapters = rawChapters;
    SEARCH_CACHE.singleChapterBookShorts = findSingleChapterBookShorts(rawChapters);
    SEARCH_CACHE.isReady = true;

    console.log(`✅ Search Engine Ready: Loaded ${rawSongs.length} songs.`);
  } catch (err) {
    console.error("❌ Failed to init search engine:", err);
  }

  console.timeEnd("Search Engine Init");
  return true;
}

// ==========================================================
// 2. MAIN SEARCH FUNCTION (Instant)
// ==========================================================
export function shouldSearchTerm(term) {
  const parsedQuery = parseBibleReferenceQuery(term);
  if (parsedQuery.normalized.length >= 3) return true;
  if (!parsedQuery.bookTerm || !SEARCH_CACHE.isReady) return false;
  if (parsedQuery.hasDigits) return true;

  const normalizedBookTerm = normalizeBibleVerse(parsedQuery.bookTerm);
  return SEARCH_CACHE.chapters.some((chapter) =>
    isSingleChapterBook(chapter) &&
    chapterMatchesBookTerm(chapter, normalizedBookTerm)
  );
}

export function searchAndDisplayResults(term) {
  if (!SEARCH_CACHE.isReady) {
    console.warn("Search is loading...");
    return; // Or show a loading spinner
  }

  // 1. Sanitize
  const originalTerm = term;
  const normalizedTerm = normalize(term);
  const containsDigit = containsSupportedDigit(originalTerm);
  let results = [];

  console.time("Search Logic");

  if (containsDigit) {
    // --- BIBLE CHAPTER SEARCH ---
    results = searchBibleReferences(originalTerm);
  } else {
    // --- SONG & BIBLE SEARCH ---
    
    // A. SEARCH SONGS (Using Fast Index)
    // A. SEARCH SONGS (Using Fast Index)
    const songCandidates = [];
    const songList = SEARCH_CACHE.songs;
    const len = songList.length;

    for (let i = 0; i < len; i++) {
        // FAST CHECK: Single string include
        if (songList[i].fastText.includes(normalizedTerm)) {
            // DETAILED CHECK: Only run if fast check passed
            const detailedMatch = calculateSongScore(songList[i].original, normalizedTerm);
            if (detailedMatch.score > 0) {
              songCandidates.push(detailedMatch);
            }
        }
    }

    // B. SEARCH BIBLE (Using Cache)
    let bibleCandidates = [];
    // Only search bible if term is 2+ words to avoid noise
    if (originalTerm.trim().split(/\s+/).length >= 1) {
      bibleCandidates = searchBibleOptimized(normalizedTerm, SEARCH_CACHE.bible);
    }

    const singleChapterCandidates = searchSingleChapterBooks(originalTerm);

    // C. MERGE & SORT
    // Combine and rank results for both together
    let allCandidates = [
      ...singleChapterCandidates,
      ...songCandidates,
      ...bibleCandidates,
    ];
    allCandidates.sort((a, b) => b.score - a.score);

    // Take Top 50
    results = allCandidates.slice(0, 50);
  }

  console.timeEnd("Search Logic");

  // Output to UI
  generateHTML(originalTerm, results);
  console.log(results)
}

let generateHTML = (term, results) => {
  // FIX 1: Update the global variable so the click handler works
  window.res = results; 
  
  search_output.innerHTML = ""; 

  let inputVal = document.querySelector("#title-input").value;
  if (inputVal.length < 1) {
    return;
  }
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto",
  });

  const maxResults = Math.min(50, results.length);

  for (let i = 0; i < maxResults; i++) {
    let slide_content = generate_item_html(results[i], term);
    
    if (slide_content) {
      let slide = document.createElement("div");
      slide.innerHTML = slide_content;
      slide.classList.add("slide-item");
      slide.style.opacity = "0"; 
      slide.style.transform = "translateY(20px)"; 
      

      // OPTIONAL: Attach the specific object to the DOM element directly
      // This is safer than relying on global 'res' index
      slide.songData = results[i];

      search_output.appendChild(slide);

      setTimeout(() => {
        slide.style.opacity = "1";
        slide.style.transform = "translateY(0)";
      }, i * 30); 
    }
  }

  if (search_output.innerHTML == "") {
    search_output.innerHTML = `
      <div class="note big bold">
        <img src="./img/warning.png" class="warning"/>
        لو بتدور على شاهد كتابي
        <br>
        جرب تكتب بالاختصارات زي:
        <br/>
        يو 4 16
        </br>
        1 كو 13
      </div>
    `;
  }
};

// ==========================================================
// 3. HELPER FUNCTIONS
// ==========================================================

function calculateSongScore(item, term) {
    let { title, chorus, verses } = item.searchableContent;
    let score = 0;
    
  // Scoring Weight Constants
  const SCORES = {
    TITLE_MATCH: 100,
    CHORUS_MATCH: 80,
    FIRST_VERSE_MATCH: 80, // Used if no chorus
    VERSE_MATCH: 50,
    EARLY_MATCH_BONUS_MAX: 30, // Max bonus for being at start
    WHOLE_WORD_BONUS: 20
  };

    let matchInTitle = false;
    let matchInChorus = null; 
    let matchInVerse = null;

  // Helper for bonuses
  const calculateBonuses = (text, index, termLength) => {
    let bonus = 0;

    // 1. Early Match Bonus (Linear decay from max bonus down to 0 at char 30)
    // e.g. Index 0 = +30, Index 15 = +15, Index 30+ = 0
    bonus += Math.max(0, SCORES.EARLY_MATCH_BONUS_MAX - index);

    // 2. Whole Word Bonus
    // Check character before and after match
    const charBefore = index > 0 ? text[index - 1] : " ";
    const charAfter = index + termLength < text.length ? text[index + termLength] : " ";

    // Simple check for spaces or boundary. 
    // Note: text is normalized, so punctuation might be gone or replaced by spaces depending on normalize function.
    // If normalize keeps spaces, this works.
    if ((charBefore === " " || index === 0) && (charAfter === " " || index + termLength === text.length)) {
      bonus += SCORES.WHOLE_WORD_BONUS;
    }

    return bonus;
  };

    // 1. Check Title
  let titleIndex = title.indexOf(term);
  if (titleIndex !== -1) {
    score += SCORES.TITLE_MATCH;
    score += calculateBonuses(title, titleIndex, term.length);
        matchInTitle = true;
    }

    // 2. Check Chorus
  if (chorus && chorus.length > 0) {
    let bestChorusScore = 0;
    let bestChorusMatch = null;

        for (let i = 0; i < chorus.length; i++) {
          let idx = chorus[i].indexOf(term);
          if (idx !== -1) {
            let currentScore = SCORES.CHORUS_MATCH;
            currentScore += calculateBonuses(chorus[i], idx, term.length);

            // Use the BEST match in the chorus
            if (currentScore > bestChorusScore) {
              bestChorusScore = currentScore;
              bestChorusMatch = { lineIndex: i, text: chorus[i] };
            }
        }
      }

      // Only add score ONCE for the entire chorus
      if (bestChorusScore > 0) {
        score += bestChorusScore;
        if (!matchInChorus) matchInChorus = bestChorusMatch;
        }
    }

    // 3. Check Verses
  if (verses && verses.length > 0) {
    // Determine if we should treat the first verse specially (if no chorus)
    const hasChorus = chorus && chorus.length > 0;
    const VERSE_DECAY = 3; // Points to subtract per verse index

        for (let v = 0; v < verses.length; v++) {
          let isFirstVerse = (v === 0);
          // If no chorus exists, promote First Verse to higher score
          let baseVerseScore = (!hasChorus && isFirstVerse) ? SCORES.FIRST_VERSE_MATCH : SCORES.VERSE_MATCH;

          // DECAY: Subtract points for later verses
          baseVerseScore = Math.max(0, baseVerseScore - (v * VERSE_DECAY));

          let bestVerseScore = 0;
          let bestVerseMatch = null;

            for (let l = 0; l < verses[v].length; l++) {
              let idx = verses[v][l].indexOf(term);
              if (idx !== -1) {
                let currentScore = baseVerseScore;
                currentScore += calculateBonuses(verses[v][l], idx, term.length);

                // Use the BEST match in this specific verse
                if (currentScore > bestVerseScore) {
                  bestVerseScore = currentScore;
                  bestVerseMatch = { verseIndex: v, lineIndex: l, text: verses[v][l] };
                }
            }
          }

          // Only add score ONCE for this verse
          if (bestVerseScore > 0) {
            score += bestVerseScore;
            // If we haven't found a verse match yet (for UI jump), store this one
            if (!matchInVerse) matchInVerse = bestVerseMatch;
            }
        }
    }

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

function searchBibleOptimized(term, bibleVerses) {
    const candidates = [];
    const len = bibleVerses.length;

  // Scoring Constants for Bible
  // We want Bible results to compete with Song Titles if the match is good.
  const SCORES = {
    VERSE_MATCH: 80, // High base score to rival song titles/choruses
    EARLY_MATCH_BONUS_MAX: 30,
    WHOLE_WORD_BONUS: 20
  };

  const calculateBonuses = (text, index, termLength) => {
    let bonus = 0;
    bonus += Math.max(0, SCORES.EARLY_MATCH_BONUS_MAX - index);
    const charBefore = index > 0 ? text[index - 1] : " ";
    const charAfter = index + termLength < text.length ? text[index + termLength] : " ";
    if ((charBefore === " " || index === 0) && (charAfter === " " || index + termLength === text.length)) {
      bonus += SCORES.WHOLE_WORD_BONUS;
    }
    return bonus;
  };


    for(let i=0; i<len; i++) {
        const verse = bibleVerses[i];
        let index = verse.text.indexOf(term);
        if(index !== -1) {
          let score = SCORES.VERSE_MATCH;
          score += calculateBonuses(verse.text, index, term.length);

            candidates.push({
              ...verse,
              score: score,
                matchedKey: "verses",
                matchedText: verse.text.substring(index, index + term.length)
            });
        }
    }
    return candidates.sort((a, b) => b.score - a.score).slice(0, 50);
}

function searchChaptersOptimized(term, bibleChapters) {
    const candidates = [];
    const len = bibleChapters.length;
    const isLongTerm = term.length >= 3;

    for(let i=0; i<len; i++) {
        const chapter = bibleChapters[i];
        let score = 0;
        let matchedKey = null;
        let matchIndex = -1;

        const normalizedShortName = normalizeBibleVerse(chapter.chapter_book_short);
        let idx = normalizedShortName.indexOf(term);
        if (idx !== -1) {
            score += 10;
            matchedKey = "chapter_book_short";
            matchIndex = idx;
        }

        if (isLongTerm) {
             idx = chapter.chapter_book_normalized.indexOf(term);
             if(idx !== -1) {
                 score += 5;
                 if(!matchedKey) {
                     matchedKey = "chapter_book_normalized";
                     matchIndex = idx;
                 }
             }
        }

        if(score > 0) {
            candidates.push({
                ...chapter,
                score,
                matchedKey,
                matchedText: (matchedKey === "chapter_book_short" ? chapter.chapter_book_short : chapter.chapter_book_normalized).substring(matchIndex, matchIndex + term.length)
            });
        }
    }
    return candidates.sort((a, b) => b.score - a.score)
}

function isSingleChapterBook(chapter) {
  return SEARCH_CACHE.singleChapterBookShorts.has(chapter.chapter_book_short);
}

function chapterMatchesBookTerm(chapter, term) {
  return normalizeBibleVerse(chapter.chapter_book_short).includes(term) ||
    (term.length >= 3 && chapter.chapter_book_normalized.includes(term));
}

function normalizeBookTerm(term) {
  const normalized = normalizeBibleVerse(term);
  return normalized === "\u0645\u0632\u0645\u0648\u0631" ? "\u0645\u0632" : normalized;
}

function searchSingleChapterBooks(term) {
  const bookTerm = normalizeBookTerm(term.trim());
  if (!bookTerm) return [];

  return searchChaptersOptimized(bookTerm, SEARCH_CACHE.chapters)
    .filter(isSingleChapterBook)
    .map((chapter) => ({
      ...chapter,
      chapter: chapter.chapter_number,
      verse: null,
      score: chapter.score + 150,
    }));
}

function searchBibleReferences(term) {
  const parsedQuery = parseBibleReferenceQuery(term);
  const bookTerm = normalizeBookTerm(parsedQuery.bookTerm);
  if (!bookTerm) return [];

  const chapterCandidates = searchChaptersOptimized(
    bookTerm,
    SEARCH_CACHE.chapters
  );
  const results = [];
  const seen = new Set();

  for (const chapter of chapterCandidates) {
    const interpretations = getReferenceInterpretations(
      parsedQuery,
      isSingleChapterBook(chapter)
    );

    for (const interpretation of interpretations) {
      if (!interpretationMatchesChapter(interpretation, chapter)) continue;

      const verse = interpretation.verse === null
        ? null
        : String(interpretation.verse);
      const resultKey = `${chapter.custom_ref}:${verse ?? "chapter"}`;
      if (seen.has(resultKey)) continue;
      seen.add(resultKey);

      results.push({
        ...chapter,
        chapter: chapter.chapter_number,
        verse,
        score: chapter.score + (interpretation.series === null ? 0 : 20),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 50);
}

function normalize(text) {
  return text.replace(/أ|آ|إ/g, "ا").replace(/ى/g, "ي").replace(/ث/g, "س").replace(/ق/g, "ك").replace(/ه/g, "ة").replace(/ذ|ظ/g, "ز").replace(/ؤ|ئ/g, "ء").replace(/[ًٌٍَُِّْ~ـٰ]/g, "").replace(/\n/g, " ");
}

function normalizeBibleVerse(text) {
  return text.replace(/أ|آ|إ/g, "ا").replace(/ى/g, "ي").replace(/ه/g, "ة").replace(/[؟!،.]/g, "");
}
