const Fuse = require("fuse.js");
const fs = require("fs");
const path = require("path");

const songsDB = JSON.parse(
    fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
);

const startTime = performance.now(); // Get start time before worker creation
const songsWithSearchableContent = songsDB.map((song) => {
    return {
        ...song,
        searchableContent: createSearchableContent(song),
    };
});
const searchableContentCreationTime = performance.now() - startTime; // Calculate time
console.log(`searchable content creation time: ${searchableContentCreationTime.toFixed(2)} ms`);


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

function performSearch(term) {
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



function createSearchableContent(song) {
    const { title, chorus, verses } = song;
    const chorusText = chorus ? chorus.join(" ") : "";
    const versesText = verses
        ? verses.map((verse) => verse.join(" ")).join(" ")
        : "";
    // const content = normalize(`${title} ${chorusText} ${versesText}`);
    let searchableSong = {
        title: normalize(title),
        chorus: normalize(chorusText),
        verses: normalize(versesText),
        firstVerse: verses[0] ? normalize(verses[0].join(" ")) : ''
    }
    // Remove duplicate words
    // const uniqueWords = [...new Set(content.split(" "))];
    // const uniqueContent = uniqueWords.join(" ");
    // console.log('done with searchable songs')
    return searchableSong
    // return content;
}

self.addEventListener('message', async (event) => {
    try {
        const searchTerm = event.data; // Store the original term
        const results = await performSearch(searchTerm);
        const data = { term: searchTerm, results }; // Combine data in an object
        self.postMessage(data);
    } catch (error) {
        console.error("Error in search:", error);
        self.postMessage({ error }); // Send error object back to main process
    }
});
