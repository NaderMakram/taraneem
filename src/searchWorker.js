const Fuse = require("fuse.js");

// let deepFuse;
let fastFuse;
let bibleTextFuse;
function performSongSearch(term) {
  const startSearchTime = Date.now(); // Get start time before worker creation

  let results = fastFuse.search(term);
  let bibleResults = bibleTextFuse.search(term);

  const searchTime = Date.now() - startSearchTime; // Calculate time
  console.log(`Actual search time: ${searchTime.toFixed(2)} ms`);
  console.log([...bibleResults, ...results]);
  return [...bibleResults, ...results];
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
  return text
    .replace(/أ|آ|إ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ه/g, "ة")
    .replace(/ؤ|ئ/g, "ء");
}

self.addEventListener("message", async (event) => {
  startTimeInFuse = Date.now();
  console.log("new message");
  try {
    const { term, songsWithSearchableContent, bibleDBIndexed } = event.data;
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

      console.log(`book_and_chapter: ${book_and_chapter}`);
      if (book_and_chapter) {
        let normalizedVerse = normalizeBibleVerse(book_and_chapter);
        // fix for searching with common spelling
        if (normalizedVerse === "مزمور") {
          normalizedVerse = "مز";
        }
        // add bible fuses
        const bibleFuse = new Fuse(bibleDBIndexed, {
          includeScore: true,
          threshold: 0.0,
          // location: 200,
          // distance: 1000,
          // ignoreLocation: true,
          minMatchCharLength: 0,
          useExtendedSearch: true,
          // includeMatches: true,
          shouldSort: true,
          keys: ["chapter_book_short", "chapter_book_normalized"],
        });

        results = bibleFuse.search(normalizedVerse);
      }
    } else {
      const startDeepFuseTime = Date.now(); // Get start time before worker creation

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

      const verseData = bibleDBIndexed.flatMap((chapter) =>
        Object.entries(chapter.normalized_verses).map(
          ([verseNum, verseText], index) => ({
            ...chapter,
            book: chapter.chapter_book_normalized,
            chapter: chapter.chapter_number,
            verse: verseNum,
            text: verseText,
            verses: chapter.verses,
            custom_ref: `verse-${index}`,
            type: "verse",
          })
        )
      );

      bibleTextFuse = new Fuse(verseData, {
        includeScore: true,
        threshold: 0,
        ignoreLocation: true,
        minMatchCharLength: 2,
        // useExtendedSearch: true,
        // includeMatches: true,
        shouldSort: true,
        keys: ["text"],
      });

      const options = {
        // includeScore: true,
        threshold: 0.0,
        // location: 200,
        // distance: 1000,
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeMatches: true,
        tokenize: (input) => {
          return normalize(input).split(/\s+/); // Split on spaces
        },
        keys: [
          { name: "searchableContent.title", weight: 0.3 },
          { name: "searchableContent.chorus", weight: 0.3 },
          { name: "searchableContent.firstVerse", weight: 0.2 },
          { name: "searchableContent.verses", weight: 0.2 },
        ],
      };

      const myIndex = Fuse.createIndex(
        options.keys,
        songsWithSearchableContent
      );
      fastFuse = new Fuse(songsWithSearchableContent, options, myIndex);
      console.log(fastFuse.list);

      const deepFuseTime = Date.now() - startDeepFuseTime; // Calculate time
      console.log(
        `time to create deep & fast fuse: ${deepFuseTime.toFixed(2)} ms`
      );
      results = await performSongSearch(normalize(searchTerm));
    }
    const data = { term: searchTerm, results, time: Date.now() }; // Combine data in an object
    self.postMessage(data);
    const timeInFuse = Date.now() - startTimeInFuse; // Calculate time
    console.log(`time of message in fuse: ${timeInFuse.toFixed(2)} ms`);
  } catch (error) {
    console.error("Error in search:", error);
    self.postMessage({ error }); // Send error object back to main process
  }
});

// console.log(`searchable content time: ${(Date.now() - startTime).toFixed(2)} ms`);
