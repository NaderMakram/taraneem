const fs = require("fs");
const path = require("path"); // Required for joining file paths

// Function to create searchable content from a song object (replace with your logic)
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
    firstVerse: verses[0] ? normalize(verses[0].join(" ")) : "",
  };
  return searchableSong;
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

// Load the songs data from JSON file
// const songsDB = JSON.parse(
//   fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
// );

// Process the data to create searchable content
// const songsWithSearchableContent = songsDB.map((song, index) => {
//   console.log(`song-${index}`);
//   return {
//     ...song, // Spread operator to copy existing song properties
//     custom_ref: `song-${index}`,
//     type: "song",
//     searchableContent: createSearchableContent(song),
//   };
// });

// Write the processed data to a JSON file
try {
  fs.writeFileSync(
    path.join(__dirname, "../src/searchableSongsDB.json"),
    JSON.stringify(songsWithSearchableContent, null, 2)
  );
  console.log(
    "Search data successfully prepared and saved to searchableSongsDB.json"
  );
} catch (error) {
  console.error("Error preparing search data:", error);
}
