import { generate_item_html } from "../helpers/htmlGenerators.js"; // Adjust path if needed

// ==========================================================
// 1. GLOBAL CACHE
// ==========================================================
const SEARCH_CACHE = {
  songs: null,
  bible: null,
  chapters: null,
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
export function searchAndDisplayResults(term) {
  if (!SEARCH_CACHE.isReady) {
    console.warn("Search is loading...");
    return; // Or show a loading spinner
  }

  // 1. Sanitize
  const originalTerm = term;
  const normalizedTerm = normalize(term);
  const containsDigit = /\d/.test(originalTerm);
  let results = [];

  console.time("Search Logic");

  if (containsDigit) {
    // --- BIBLE CHAPTER SEARCH ---
    let termWithoutSpaces = originalTerm.trim().replace(/\s+/g, " ");
    let book_and_chapter = termWithoutSpaces.replace(/[^\u0600-\u06FF\s]/g, "").trim();

    if (book_and_chapter) {
      let normalChapter = normalizeBibleVerse(book_and_chapter);
      if (normalChapter === "مزمور") normalChapter = "مز";
      
      // Use Cached Chapters
      results = searchChaptersOptimized(normalChapter, SEARCH_CACHE.chapters);
    }
  } else {
    // --- SONG & BIBLE SEARCH ---
    
    // A. SEARCH SONGS (Using Fast Index)
    const candidates = [];
    const songList = SEARCH_CACHE.songs;
    const len = songList.length;

    for (let i = 0; i < len; i++) {
        // FAST CHECK: Single string include
        if (songList[i].fastText.includes(normalizedTerm)) {
            // DETAILED CHECK: Only run if fast check passed
            const detailedMatch = calculateSongScore(songList[i].original, normalizedTerm);
            if (detailedMatch.score > 0) {
                candidates.push(detailedMatch);
            }
        }
    }
    
    // Sort and Take Top 50
    candidates.sort((a, b) => b.score - a.score);
    const songResults = candidates.slice(0, 50);

    // B. SEARCH BIBLE (Using Cache)
    let bibleResults = [];
    // Only search bible if term is 2+ words to avoid noise
    if (originalTerm.trim().split(/\s+/).length >= 1) {
       bibleResults = searchBibleOptimized(normalizedTerm, SEARCH_CACHE.bible);
    }


    // results = [...songResults, ...bibleResults];
    results = [...bibleResults];
  }

  console.timeEnd("Search Logic");

  // Output to UI
  generateHTML(originalTerm, results);
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

  let filtered_results = results;
  let containsDigit = /\d/.test(term);
  
  if (containsDigit) {
    filtered_results = results.filter((item) => {
      if (item.chapter_number) {
        let cleanTerm = term.trim();
        let match = cleanTerm.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);
        if (match) {
          let searched_chapter = match[1];
          return searched_chapter == item.chapter_number;
        }
      }
      return false; 
    });
  }

  const maxResults = Math.min(50, filtered_results.length);

  for (let i = 0; i < maxResults; i++) {
    let slide_content = generate_item_html(filtered_results[i], term);
    
    if (slide_content) {
      let slide = document.createElement("div");
      slide.innerHTML = slide_content;
      slide.classList.add("slide-item");
      slide.style.opacity = "0"; 
      slide.style.transform = "translateY(20px)"; 
      

      // OPTIONAL: Attach the specific object to the DOM element directly
      // This is safer than relying on global 'res' index
      slide.songData = filtered_results[i]; 

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
    
    let matchInTitle = false;
    let matchInChorus = null; 
    let matchInVerse = null;

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
    for(let i=0; i<len; i++) {
        const verse = bibleVerses[i];
        let index = verse.text.indexOf(term);
        if(index !== -1) {
            candidates.push({
                ...verse, // Clone here is okay for small results, or use pointer method if slow
                score: 2,
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

        let idx = chapter.chapter_book_short.indexOf(term);
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

function normalize(text) {
  return text.replace(/أ|آ|إ/g, "ا").replace(/ى/g, "ي").replace(/ث/g, "س").replace(/ق/g, "ك").replace(/ه/g, "ة").replace(/ذ|ظ/g, "ز").replace(/ؤ|ئ/g, "ء").replace(/[ًٌٍَُِّْ~ـٰ]/g, "").replace(/\n/g, " ");
}

function normalizeBibleVerse(text) {
  return text.replace(/أ|آ|إ/g, "ا").replace(/ى/g, "ي").replace(/ه/g, "ة").replace(/[؟!،.]/g, "");
}