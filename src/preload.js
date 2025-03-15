const { contextBridge, ipcRenderer } = require("electron");
const Sortable = require("sortablejs");
const fs = require("fs");
const path = require("path");

const songsDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
);
const bibleDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "bible_normalized.json"), "utf-8")
);

const prevNextIndices = bibleDB.map((_, index) => ({
  prevIndex: index - 1 >= 0 ? index - 1 : null,
  nextIndex: index + 1 < bibleDB.length ? index + 1 : null,
}));

const bibleDBIndexed = bibleDB.map((item, index) => {
  const { prevIndex, nextIndex } = prevNextIndices[index];
  return {
    ...item,
    siblings: [prevIndex, nextIndex],
    prevShort: bibleDB[prevIndex]?.chapter_book_short,
    prevNum: bibleDB[prevIndex]?.chapter_number,
    nextShort: bibleDB[nextIndex]?.chapter_book_short,
    nextNum: bibleDB[nextIndex]?.chapter_number,
    custom_ref: `chapter-${index}`,
  };
});

const bibleVerses = bibleDBIndexed.flatMap((chapter) =>
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

const songsWithSearchableContent = songsDB.map((song, index) => {
  return {
    ...song,
    searchableContent: createSearchableContent(song),
    custom_ref: `song-${index}`,
  };
});

contextBridge.exposeInMainWorld("myCustomAPI", {
  bibleDBIndexed,
  songsWithSearchableContent,
  bibleVerses,
  changeTitleTo: (title) => ipcRenderer.send("set-title", title),
  flipSearchingMode: () => ipcRenderer.send("flip-searching-mode"),
  searchTerm: (term) => ipcRenderer.invoke("search-songs", term),
  updateSongWindow: (content, isBible) => {
    ipcRenderer.send("update-song-window", content, isBible);
    // console.log(content.clientHeight);
    // window.scrollBy(0, content.clientHeight);
  },
  updateFontSize: (content) => ipcRenderer.send("update-font-size", content),
  updateFontWeight: () => ipcRenderer.send("update-font-weight"),
  extendSongWindow: () => ipcRenderer.send("extend-song-window"),
  toggleDarkMode: () => ipcRenderer.send("toggle-dark-mode"),
  getSiblingChapter: (content) =>
    ipcRenderer.invoke("get-sibling-chapter", content),
  quitAndInstall: () => ipcRenderer.send("quit-and-install"),
  scrollToActive: (Yamount) => ipcRenderer.send("scroll-to-active"),
  readJson: () => ipcRenderer.invoke("read-json"),
  createSortable: (el, options) => Sortable.create(el, options),
});

ipcRenderer.on("log", (event, message) => {
  console.log(message);
});

ipcRenderer.on("search-results", (event, results) => {
  // Handle search results (e.g., update UI with results)
  console.log(results);
});

ipcRenderer.on("shift-to-slide", (event, message) => {
  console.log("shift the slide", message);
  // let element = document.querySelector('[data-verseNumber="1"]');
  // const elements = document.querySelector(".song-preview").children;
  // for (let i = 0; i < elements.length; i++) {
  //   elements[i].classList.remove("active");
  // }

  // element.classList.add("active");
  // ipcRenderer.send("update-song-window", element.innerHTML);
});

function createSearchableContent(song) {
  const { title, chorus, verses } = song;
  const chorusText = chorus ? chorus.join(" ") : "";
  const versesText = verses
    ? verses.map((verse) => verse.join(" ")).join(" ")
    : "";
  // const content = normalize(`${title} ${chorusText} ${versesText}`);
  let searchableSong = {
    title: title,
    chorus: normalize(chorusText),
    verses: normalize(versesText),
    firstVerse: verses[0] ? normalize(verses[0].join(" ")) : "",
  };
  // Remove duplicate words
  // const uniqueWords = [...new Set(content.split(" "))];
  // const uniqueContent = uniqueWords.join(" ");
  return searchableSong;
  // return content;
}

// normalize song text
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
