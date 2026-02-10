// const Fuse = require("fuse.js");

// let deepFuse;
// let fastFuse;
// let bibleTextFuse;
function performSearch(term, songsWithSearchableContent, bibleVerses) {
  const startSearchTime = Date.now(); // Get start time before worker creation

  // console.log(`term: ${term}, songs: ${songsWithSearchableContent}`);
  let songResults = searchSongs(term, songsWithSearchableContent);
  let bibleResults = [];
  if (term.trim().split(/\s+/).length >= 3) {
    bibleResults = searchBible(term, bibleVerses);
  }

  const searchTime = Date.now() - startSearchTime; // Calculate time
  console.log(`Actual search time: ${searchTime.toFixed(2)} ms`);
  // console.log(`songResults: ${songResults}`);
  // console.log(`bibleResults: ${bibleResults}`);
  return [...songResults, ...bibleResults];
}

function performChapterSearch(term, bibleChapters) {
  //   keys: ["chapter_book_short", "chapter_book_normalized"],

  return bibleChapters
    .map((chapter) => {
      let { chapter_book_short, chapter_book_normalized } = chapter;
      let score = 0;
      let matchedKey = null;
      let matchedText = null;

      // Check book short
      let index = chapter_book_short.indexOf(term);
      if (index !== -1) {
        score += 10;
        matchedKey = "chapter_book_short";
        matchedText = chapter_book_short.substring(index, index + term.length);
      }

      // Check chapter book long (normalized) only if term is longer than 3 charachters
      if (term.length >= 3) {
        index = chapter_book_normalized.indexOf(term);
        if (index !== -1) {
          score += 5;
          matchedKey = matchedKey || "chapter_book_normalized"; // Keep first match priority
          matchedText =
            matchedText ||
            chapter_book_normalized.substring(index, index + term.length);
        }
      }

      return { ...chapter, score, matchedKey, matchedText };
    })
    .filter((chapter) => chapter.score > 0) // Keep only matches
    .sort((a, b) => b.score - a.score); // Sort by score (highest first)
}

// let i = 0;
function searchSongs(term, songsWithSearchableContent) {
  return songsWithSearchableContent
    .map((item) => {
      let { title, chorus, verses } = item.searchableContent;
      let score = 0;
      
      let matchInTitle = false;
      let matchInChorus = null; // { lineIndex, text }
      let matchInVerse = null;  // { verseIndex, lineIndex, text }

      // 1. Check Title
      if (title.includes(term)) {
        score += 10;
        matchInTitle = true;
      }

      // 2. Check Chorus
      if (chorus && chorus.length > 0) {
        for (let i = 0; i < chorus.length; i++) {
          if (chorus[i].includes(term)) {
            score += 5;
            if (!matchInChorus) {
              matchInChorus = { lineIndex: i, text: chorus[i] };
            }
          }
        }
      }

      // 3. Check Verses
      if (verses && verses.length > 0) {
        for (let v = 0; v < verses.length; v++) {
          let verseLines = verses[v];
          for (let l = 0; l < verseLines.length; l++) {
            if (verseLines[l].includes(term)) {
              score += 2;
              if (!matchInVerse) {
                matchInVerse = { verseIndex: v, lineIndex: l, text: verseLines[l] };
              }
            }
          }
        }
      }

      // --- DETERMINE LOCATIONS ---
      let matchedKey = null;
      let matchedText = null;
      let matchLocation = null; // For UI Display (Badge & Highlight)
      let jumpLocation = null;  // For Click Action (Which slide to activate)

      // Priority 1: Title
      if (matchInTitle) {
        matchedKey = "title";
        matchedText = title;
        matchLocation = { section: "title" };

        // Even if Title matches, we check if we can jump to a specific slide
        if (matchInChorus) {
            jumpLocation = { 
                section: "chorus", 
                slideIndex: matchInChorus.lineIndex 
            };
        } else if (matchInVerse) {
            jumpLocation = { 
                section: "verse", 
                verseIndex: matchInVerse.verseIndex, 
                slideIndex: matchInVerse.lineIndex 
            };
        }
      } 
      // Priority 2: Chorus
      else if (matchInChorus) {
        matchedKey = "chorus";
        matchedText = matchInChorus.text;
        matchLocation = { 
            section: "chorus", 
            slideIndex: matchInChorus.lineIndex 
        };
        jumpLocation = matchLocation; // Same for jump
      } 
      // Priority 3: Verse
      else if (matchInVerse) {
        matchedKey = "verses";
        matchedText = matchInVerse.text;
        matchLocation = { 
            section: "verse", 
            verseIndex: matchInVerse.verseIndex, 
            slideIndex: matchInVerse.lineIndex 
        };
        jumpLocation = matchLocation; // Same for jump
      }

      return { ...item, score, matchedKey, matchedText, matchLocation, jumpLocation };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}


function searchBible(term, bibleDBIndexed) {
  return bibleDBIndexed
    .map((verse) => {
      // console.log(verse);
      // return;
      let score = 0;
      let matchedKey = null;
      let matchedText = null;

      // Check Verses
      index = verse.text.indexOf(term);
      if (index !== -1) {
        score += 2;
        matchedKey = matchedKey || "verses";
        matchedText =
          matchedText || verse.text.substring(index, index + term.length);
      }

      return { ...verse, score, matchedKey, matchedText };
    })
    .filter((verse) => verse.score > 0) // Keep only matches
    .sort((a, b) => b.score - a.score); // Sort by score (highest first)
}

function normalize(text) {
  return (
    text
      .replace(/أ|آ|إ/g, "ا") // Treat أ, إ, and ا as the same
      .replace(/ى/g, "ي")
      .replace(/ث/g, "س")
      .replace(/ق/g, "ك")
      .replace(/ه/g, "ة")
      .replace(/ذ|ظ/g, "ز")
      .replace(/ؤ|ئ/g, "ء")
      // remove tashkeel
      .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
      // remove \n
      .replace(/\n/g, " ")
  );
}

function normalizeBibleVerse(text) {
  return (
    text
      .replace(/أ|آ|إ/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ه/g, "ة")
      // .replace(/ؤ|ئ/g, "ء")
      .replace(/[؟!،.]/g, "")
  ); // Removes ?, !, ،, and .
}

self.addEventListener("message", async (event) => {
  startTimeInFuse = Date.now();
  console.log("new message");
  try {
    const { term, songsWithSearchableContent, bibleDBIndexed, bibleVerses } =
      event.data;
    const bibleStartSearchTime = Date.now(); // Get start time before worker creation
    const searchTerm = term; // Store the original term
    let containsDigit = /\d/.test(searchTerm);
    let results;
    console.log(
      `bible search time: ${(Date.now() - bibleStartSearchTime).toFixed(2)} ms`
    );

    if (containsDigit) {
      // do bible search
      let termWithoutSpaces = searchTerm.trim().replace(/\s+/g, " ");
      let book_and_chapter = termWithoutSpaces
        .replace(/[^\u0600-\u06FF\s]/g, "")
        .trim();

      // console.log(`book_and_chapter: ${book_and_chapter}`);
      if (book_and_chapter) {
        let normalChapter = normalizeBibleVerse(book_and_chapter);
        // fix for searching with common spelling
        if (normalChapter === "مزمور") {
          normalChapter = "مز";
        }
        // const bibleFuse = new Fuse(bibleDBIndexed, {
        //   includeScore: true,
        //   threshold: 0.0,
        //   // location: 200,
        //   // distance: 1000,
        //   // ignoreLocation: true,
        //   minMatchCharLength: 0,
        //   useExtendedSearch: true,
        //   // includeMatches: true,
        //   shouldSort: true,
        //   keys: ["chapter_book_short", "chapter_book_normalized"],
        // });

        results = performChapterSearch(normalChapter, bibleDBIndexed);
        // console.log(results);
      }
    } else {
      // const startDeepFuseTime = Date.now(); // Get start time before worker creation

      // deepFuse = new Fuse(songsWithSearchableContent, {
      //   // includeScore: true,
      //   threshold: 0.0, // Adjust as needed
      //   // location: 200,
      //   // distance: 1000,
      //   ignoreLocation: true,
      //   minMatchCharLength: 2,
      //   // shouldSort: true,
      //   tokenize: (input) => {
      //     return normalize(input).split(/\s+/); // Split on spaces
      //   },
      //   keys: [
      //     { name: "searchableContent.title", weight: 0.3 },
      //     { name: "searchableContent.chorus", weight: 0.3 },
      //     { name: "searchableContent.firstVerse", weight: 0.2 },
      //     { name: "searchableContent.verses", weight: 0.2 },
      //   ],
      // });

      // bibleTextFuse = new Fuse(bibleVerses, {
      //   includeScore: true,
      //   threshold: 0,
      //   ignoreLocation: true,
      //   minMatchCharLength: 2,
      //   // useExtendedSearch: true,
      //   // includeMatches: true,
      //   shouldSort: true,
      //   keys: ["text"],
      // });

      // const options = {
      //   // includeScore: true,
      //   threshold: 0.0,
      //   // location: 200,
      //   // distance: 1000,
      //   ignoreLocation: true,
      //   minMatchCharLength: 2,
      //   includeMatches: true,
      //   tokenize: (input) => {
      //     return normalize(input).split(/\s+/); // Split on spaces
      //   },
      //   keys: [
      //     { name: "searchableContent.title", weight: 0.3 },
      //     { name: "searchableContent.chorus", weight: 0.3 },
      //     { name: "searchableContent.firstVerse", weight: 0.2 },
      //     { name: "searchableContent.verses", weight: 0.2 },
      //   ],
      // };

      // const deepFuseTime = Date.now() - startDeepFuseTime; // Calculate time
      // console.log(
      //   `time to create flat flat map: ${deepFuseTime.toFixed(2)} ms`
      // );

      console.time("Time to search bible and songs");
      results = performSearch(
        normalize(searchTerm),
        songsWithSearchableContent,
        bibleVerses
      );
      console.timeEnd("Time to search bible and songs");
    }
    const data = { term: searchTerm, results, time: Date.now() }; // Combine data in an object
    // console.log(`data: ${data}`);
    self.postMessage(data);
    // const timeInFuse = Date.now() - startTimeInFuse; // Calculate time
    // console.log(`time of message in fuse: ${timeInFuse.toFixed(2)} ms`);
  } catch (error) {
    console.error("Error in search:", error);
    self.postMessage({ error }); // Send error object back to main process
  }
});

// console.log(`searchable content time: ${(Date.now() - startTime).toFixed(2)} ms`);
