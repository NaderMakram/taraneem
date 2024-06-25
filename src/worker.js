// self.addEventListener('message', async (event) => {
//     try {
//         const searchTerm = event.data; // Store the original term
//         let containsDigit = /\d/.test(searchTerm);
//         let results;
//         if (containsDigit) {
//             // do bible search
//             let termWithoutSpaces = searchTerm.replace(/\s+/g, "");
//             let book_and_chapter = termWithoutSpaces.match(
//                 /(?:\b\d+)?[\u0600-\u06FF]+/
//             );
//             if (book_and_chapter) {
//                 let normalizedVerse = normalizeBibleVerse(book_and_chapter[0]);
//                 // fix for searching with common spelling
//                 if (normalizedVerse === "مزمور") {
//                     normalizedVerse = "مز";
//                 }
//                 const bibleStartSearchTime = performance.now(); // Get start time before worker creation
//                 results = bibleShortFuse.search("=" + normalizedVerse);
//                 if (results.length === 0) {
//                     results = bibleLongFuse.search(normalizedVerse);

//                 }
//                 const bibleSearchTime = performance.now() - bibleStartSearchTime; // Calculate time
//                 console.log(`bible search time: ${bibleSearchTime.toFixed(2)} ms`);
//             }
//         } else {

//             results = await performSongSearch(normalize(searchTerm));
//         }
//         const data = { term: searchTerm, results }; // Combine data in an object
//         self.postMessage(data);
//     } catch (error) {
//         console.error("Error in search:", error);
//         self.postMessage({ error }); // Send error object back to main process
//     }
// });
// console.log('hi from worker', self)
onmessage = function (event) {
    console.log('Received data in worker:', event.data);

    // Process the received data and send a response back
    const response = { message: 'Hello, main thread!' };
    self.postMessage(response);
};
