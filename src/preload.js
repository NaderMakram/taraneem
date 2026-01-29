const { contextBridge, ipcRenderer } = require("electron");
const Sortable = require("sortablejs");
const fs = require("fs");
const path = require("path");

const userDataArg = process.argv.find((arg) =>
  arg.startsWith("--userDataPath=")
);
const userDataPath = userDataArg
  ? userDataArg.replace("--userDataPath=", "")
  : null;

// ✅ You can now use this path *inside preload.js*
console.log("User Data Path:", userDataPath);



// --- LAZY LOAD BIBLE DATA ---
let _bibleCache = null;
function getBibleData() {
  if (!_bibleCache) {
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
          custom_ref: `chapter-${chapter.chapter_en}-verse-${index}`,
          type: "verse",
        })
      )
    );
    _bibleCache = { bibleDBIndexed, bibleVerses };
  }
  return _bibleCache;
}

// --- LAZY LOAD SONGS DATA ---
let _songsCache = null;
function loadSongs() {
  // Use the userDataPath we got from additionalArguments
  const fs = require("fs");
  const path = require("path");

  // Use app data folder for local DBs (writable)
  const localDBPath = path.join(userDataPath, "localTaraneemDB.json");

  // Use __dirname for read-only bundled DB
  const mainDBPath = path.join(__dirname, "taraneemDB.json");

  // Make sure local file exists, otherwise create empty one
  if (!fs.existsSync(localDBPath)) {
    fs.writeFileSync(localDBPath, "[]", "utf-8");
  }

  // Read local songs
  const localSongsDB = JSON.parse(fs.readFileSync(localDBPath, "utf-8"));

  const localSongsWithSearchableContent = localSongsDB.map((song, index) => ({
    ...song,
    searchableContent: createSearchableContent(song),
    custom_ref: `local-song-${index}`,
  }));

  // Read main bundled songs
  const songsDB = JSON.parse(fs.readFileSync(mainDBPath, "utf-8"));

  const songsWithSearchableContent = songsDB.map((song, index) => ({
    ...song,
    searchableContent: createSearchableContent(song),
    custom_ref: `song-${index}`,
  }));

  return [...songsWithSearchableContent, ...localSongsWithSearchableContent];
}

function getSongsData() {
  if (!_songsCache) {
    _songsCache = loadSongs();
  }
  return _songsCache;
}


contextBridge.exposeInMainWorld("myCustomAPI", {
  // Converted to getters for lazy loading
  getBibleDBIndexed: () => getBibleData().bibleDBIndexed,
  getBibleVerses: () => getBibleData().bibleVerses,

  getSongs: () => getSongsData(),

  reloadSongs: () => {
    _songsCache = loadSongs(); // Reload cache
    return _songsCache;
  },

  getLocalSongs: () => ipcRenderer.invoke("get-local-songs"),
  getSong: (songId) => ipcRenderer.invoke("get-song", songId),
  updateSong: (songId, song) => ipcRenderer.invoke("update-song", songId, song),
  deleteSong: (songId) => ipcRenderer.invoke("delete-song", songId),

  // bibleVerses, // Removed direct property exposure
  saveSong: (song) => ipcRenderer.invoke("save-song", song),

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
  setTheme: (theme) => ipcRenderer.send("set-theme", theme),
  setAlignment: (alignment) => ipcRenderer.send("set-alignment", alignment),

  getSiblingChapter: (content) =>
    ipcRenderer.invoke("get-sibling-chapter", content),
  quitAndInstall: () => ipcRenderer.send("quit-and-install"),
  scrollToActive: (Yamount) => ipcRenderer.send("scroll-to-active"),
  readJson: () => ipcRenderer.invoke("read-json"),
  createSortable: (el, options) => Sortable.create(el, options),
  appReady: () => ipcRenderer.send("app-ready"),
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

  // Helper to normalize an array of strings (lines)
  const normalizeLines = (lines) =>
    lines ? lines.map((line) => normalize(line)) : [];

  // Helper to normalize an array of arrays (verses -> lines)
  const normalizeVerses = (verses) =>
    verses ? verses.map((verse) => normalizeLines(verse)) : [];

  let searchableSong = {
    title: normalize(title),
    chorus: normalizeLines(chorus), // Keeps array structure: ["line 1", "line 2"]
    verses: normalizeVerses(verses), // Keeps nested structure: [["v1l1", "v1l2"], ["v2l1"]]
  };

  return searchableSong;
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
