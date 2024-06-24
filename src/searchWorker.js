const Fuse = require("fuse.js");
const fs = require("fs");
const path = require("path");

const songsWithSearchableContent = JSON.parse(
    fs.readFileSync(path.join(__dirname, "searchableSongsDB.json"), "utf-8")
);





const deepFuse = new Fuse(songsWithSearchableContent, {
    // includeScore: true,
    threshold: 0.2, // Adjust as needed
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
        { name: "searchableContent.verses", weight: 0.2 }],
});

const fastFuse = new Fuse(songsWithSearchableContent, {
    // includeScore: true,
    threshold: 0.0,
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
        { name: "searchableContent.verses", weight: 0.2 }],
});

const bibleDB = JSON.parse(
    fs.readFileSync(path.join(__dirname, "chapters_only.json"), "utf-8")
);

const prevNextIndices = bibleDB.map((_, index) => ({
    prevIndex: index - 1 >= 0 ? index - 1 : null,
    nextIndex: index + 1 < bibleDB.length ? index + 1 : null,
}));

const startTime = performance.now();
const bibleDBIndexed = bibleDB.map((item, index) => {
    const { prevIndex, nextIndex } = prevNextIndices[index];
    return {
        ...item,
        siblings: [prevIndex, nextIndex],
        prevShort: bibleDB[prevIndex]?.chapter_book_short,
        prevNum: bibleDB[prevIndex]?.chapter_number,
        nextShort: bibleDB[nextIndex]?.chapter_book_short,
        nextNum: bibleDB[nextIndex]?.chapter_number,
    };
});


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



function performSongSearch(term) {
    const startSearchTime = performance.now(); // Get start time before worker creation

    let results = fastFuse.search(term);
    if (results.length === 0) {
        console.log(results, 'trying deep')
        results = deepFuse.search(term);
    }
    const searchTime = performance.now() - startSearchTime; // Calculate time
    console.log(`search time: ${searchTime.toFixed(2)} ms`);
    // console.log(results)
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


self.addEventListener('message', async (event) => {
    try {
        const searchTerm = event.data; // Store the original term
        let containsDigit = /\d/.test(searchTerm);
        let results;
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
                const bibleStartSearchTime = performance.now(); // Get start time before worker creation
                results = bibleShortFuse.search("=" + normalizedVerse);
                if (results.length === 0) {
                    results = bibleLongFuse.search(normalizedVerse);

                }
                const bibleSearchTime = performance.now() - bibleStartSearchTime; // Calculate time
                console.log(`bible search time: ${bibleSearchTime.toFixed(2)} ms`);
            }
        } else {

            results = await performSongSearch(normalize(searchTerm));
        }
        const data = { term: searchTerm, results }; // Combine data in an object
        self.postMessage(data);
    } catch (error) {
        console.error("Error in search:", error);
        self.postMessage({ error }); // Send error object back to main process
    }
});

console.log(`searchable content time: ${(performance.now() - startTime).toFixed(2)} ms`);
