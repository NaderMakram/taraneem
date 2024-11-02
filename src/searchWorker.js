const Fuse = require("fuse.js");

let deepFuse;
let fastFuse;
function performSongSearch(term) {
  const startSearchTime = Date.now(); // Get start time before worker creation

  let results = fastFuse.search(term);
  //   if (results.length === 0) {
  //     console.log(results, "trying deep");
  //     results = deepFuse.search(term);
  //   }
  const searchTime = Date.now() - startSearchTime; // Calculate time
  console.log(`search time: ${searchTime.toFixed(2)} ms`);
  console.log(results);
  return results;
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
      let termWithoutSpaces = searchTerm.replace(/\s+/g, "");
      let book_and_chapter = termWithoutSpaces.match(
        /(?:\b\d+)?[\u0600-\u06FF]+/
      );
      if (book_and_chapter) {
        let normalizedVerse = normalizeBibleVerse(book_and_chapter[0]);
        // fix for searching with common spelling
        if (normalizedVerse === "مزمور") {
          normalizedVerse = "مز";
        }
        // add bible fuses
        const bibleShortFuse = new Fuse(bibleDBIndexed, {
          includeScore: true,
          threshold: 0.0,
          // location: 200,
          // distance: 1000,
          ignoreLocation: true,
          minMatchCharLength: 0,
          useExtendedSearch: true,
          // includeMatches: true,
          shouldSort: true,
          keys: ["chapter_book_short"],
        });

        const bibleLongFuse = new Fuse(bibleDBIndexed, {
          includeScore: true,
          threshold: 0.15,
          // location: 200,
          // distance: 1000,
          ignoreLocation: true,
          minMatchCharLength: 0,
          // includeMatches: true,
          shouldSort: true,
          keys: ["chapter_book_normalized"],
        });

        results = bibleShortFuse.search("=" + normalizedVerse);
        if (results.length === 0) {
          results = bibleLongFuse.search(normalizedVerse);
        }
      }
    } else {
      const startDeepFuseTime = Date.now(); // Get start time before worker creation

      deepFuse = new Fuse(songsWithSearchableContent, {
        // includeScore: true,
        threshold: 0.05, // Adjust as needed
        // location: 200,
        // distance: 1000,
        ignoreLocation: true,
        minMatchCharLength: 2,
        // shouldSort: true,
        tokenize: (input) => {
          return normalize(input).split(/\s+/); // Split on spaces
        },
        keys: [
          { name: "searchableContent.title", weight: 0.3 },
          { name: "searchableContent.chorus", weight: 0.3 },
          { name: "searchableContent.firstVerse", weight: 0.2 },
          { name: "searchableContent.verses", weight: 0.2 },
        ],
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
