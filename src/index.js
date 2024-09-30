const { app, BrowserWindow, screen, ipcMain } = require("electron");
// const { autoUpdater } = require("electron-updater");
const isDev = require("electron-is-dev");
const path = require("path");
const fs = require("fs");
const Fuse = require("fuse.js");
const { jsPDF } = require("jspdf");

// const { Worker } = require('worker_threads');

// const AutoScroll = require("sortablejs/modular/sortable.core.esm");
// console.log("autoscroll", AutoScroll);
// const { dragula } = require("dragula");

// auto update
// const { updateElectronApp } = require("update-electron-app");
// updateElectronApp();

// if (!isDev) {
//   const server = "https://update.electronjs.org";
//   const feed = `${server}/OWNER/REPO/${process.platform}-${
//     process.arch
//   }/${app.getVersion()}`;
//   autoUpdater.setFeedURL(feed);
//   app.on("ready", () => {
//     autoUpdater.checkForUpdates();
//   });
// }

let fastSearch = true;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const songsDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
);

const bibleDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "chapters_only.json"), "utf-8")
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
  };
});

// Map your songs array and create searchable content for each song
console.time("creating content time:");
const songsWithSearchableContent = songsDB.map((song) => {
  return {
    ...song,
    searchableContent: createSearchableContent(song),
  };
});
console.timeEnd("creating content time:");
// console.timeEnd("MappingSongs");
// const filename = 'songs-with-searchable-content.json';
// writeSongsToJSON(songsWithSearchableContent, filename);

// Function to write the songs data to a JSON file
function writeSongsToJSON(data, filename) {
  const jsonData = JSON.stringify(data, null, 2); // Stringify with indentation for readability

  try {
    fs.writeFileSync(filename, jsonData);
    console.log(`Songs data successfully exported to ${filename}`);
  } catch (error) {
    console.error("Error writing songs data to JSON file:", error);
  }
}

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
    { name: "searchableContent.verses", weight: 0.2 },
  ],
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
    { name: "searchableContent.verses", weight: 0.2 },
  ],
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

// Function to create a searchable content string for each song
function createSearchableContent(song) {
  const { title, chorus, verses } = song;
  const chorusText = chorus ? chorus.join(" ") : "";
  const versesText = verses
    ? verses.map((verse) => verse.join(" ")).join(" ")
    : "";
  const content = normalize(`${title} ${chorusText} ${versesText}`);
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

function normalizeBibleVerse(text) {
  return text
    .replace(/أ|آ|إ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ه/g, "ة")
    .replace(/ؤ|ئ/g, "ء");
}

let fastFuseController;
let deepFuseController;
async function performSearch(normalizedTerm) {
  // Abort any ongoing searches
  if (fastFuseController) fastFuseController.abort();
  if (deepFuseController) deepFuseController.abort();

  // Create new AbortControllers for the new search
  fastFuseController = new AbortController();
  deepFuseController = new AbortController();

  try {
    // Start the fastFuse search with the abort signal
    let results = await fastFuse.search(normalizedTerm, {
      signal: fastFuseController.signal,
    });

    // If no results, start the deepFuse search with the abort signal
    if (results.length === 0) {
      results = await deepFuse.search(normalizedTerm, {
        signal: deepFuseController.signal,
      });
    }

    return results;
  } catch (err) {
    // Handle the abort error
    if (err.name === "AbortError") {
      console.log("Search aborted");
    } else {
      console.error("Search failed:", err);
    }
  }
}

// Function to search for songs
function searchSongs(event, term) {
  let containsDigit = /\d/.test(term);

  console.time("searching time");
  // console.log(BrowserWindow.getAllWindows());
  // console.log(fastSearch);
  let results;
  if (containsDigit) {
    // do bible search
    let termWithoutSpaces = term.replace(/\s+/g, "");
    let book_and_chapter = termWithoutSpaces.match(
      /(?:\b\d+)?[\u0600-\u06FF]+/
    );
    if (book_and_chapter) {
      let normalizedVerse = normalizeBibleVerse(book_and_chapter[0]);
      // fix for searching with common spelling
      if (normalizedVerse === "مزمور") {
        normalizedVerse = "مز";
      }
      results = bibleShortFuse.search("=" + normalizedVerse);
      if (results.length === 0) {
        results = bibleLongFuse.search(normalizedVerse);
      }
    }
  } else {
    // do song search
    let normalizedTerm = normalize(term);
    if (fastSearch) {
      // results = fastFuse.search(normalizedTerm);
      // if (results.length === 0) {
      //   results = deepFuse.search(normalizedTerm);
      // }
      results = performSearch(normalizedTerm);
    } else {
      results = deepFuse.search(normalizedTerm);
    }
  }

  console.timeEnd("searching time");
  return results;
}

const handleSetTitle = (event, title) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.setTitle(title);
};

function readJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
  );
}
app.on("ready", () => {
  ipcMain.on("set-title", handleSetTitle);
  ipcMain.handle("search-songs", async (event, term) => {
    // Post data to the worker
    worker.postMessage({ term });
  });
  ipcMain.on("flip-searching-mode", () => {
    fastSearch = !fastSearch;
  });
  ipcMain.handle("read-json", readJson);
  console.log(fastSearch);
  // const container = document.getElementById("jsoneditor");
  // const options = {};
  // const editor = new JSONEditor(container, options);
});

let mainWindow;
const createMainWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 600,
    icon: path.join(__dirname, "assets", "taraneem logo transparent.png"),
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      // contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

  // mainWindow.maximize();

  // remove menu
  mainWindow.removeMenu();
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    app.quit();
  });
};

// song window
let songWindow;

const createSongWindow = () => {
  let displays = screen.getAllDisplays();
  if (displays.length > 1) {
    const secondScreen = displays[1];
    songWindow = new BrowserWindow({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      icon: path.join(__dirname, "assets", "taraneem logo transparent.png"),
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
      frame: false,
      alwaysOnTop: false,
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        preload: path.join(__dirname, "songPreload.js"),
      },
    });
    songWindow.setFullScreen(true);
  } else {
    songWindow = new BrowserWindow({
      show: isDev ? true : false,
      frame: isDev ? true : false,
      width: 500,
      height: 400,
      icon: path.join(__dirname, "assets", "taraneem logo transparent.png"),
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        preload: path.join(__dirname, "songPreload.js"),
      },
    });
  }

  songWindow.removeMenu();
  // and load the index.html of the app.
  songWindow.loadFile(path.join(__dirname, "song.html"));

  // remove menu
  songWindow.on("closed", () => {
    app.quit();
  });
  if (isDev) {
    songWindow.webContents.openDevTools();
  }
};

app.on("ready", createSongWindow);
app.on("ready", createMainWindow);
app.on("ready", addIPCs);
// init dragula
// app.on("ready", () => {
//   mainWindow.webContents.executeJavaScript(
//     `
//     let drake = dragula([document.querySelector('#waiting_output')], {
//       moves: function (el, container, handle) {
//         return handle.classList.contains('handle');
//       }
//     })
//     drake.on("drop", (el, target, source, sibling)=>{
//       console.log(el, target, source, sibling)
//     })
//     `
//   );
// });
// app.on("ready", () => {
//   let currentVersion = app.getVersion();
//   updateVersionMessage(`version: ${currentVersion}`);
// });
function addIPCs() {
  ipcMain.on("update-song-window", (event, content, isBible) => {
    songWindow.webContents.send("update-song-window", content, isBible);
    if (content != "") {
      mainWindow.webContents.executeJavaScript(
        `
        element = document.querySelector('.active');
        if(element){

          elementRect = element.getBoundingClientRect();
          absoluteElementTop = elementRect.top + window.pageYOffset;
          middle = absoluteElementTop - (window.innerHeight / 2);
          window.scrollTo({
            top: middle,
            left: 0,
            behavior: "smooth",
          });
        }
        `
      );
    }
  });
}

ipcMain.on("update-font-size", (event, message) => {
  songWindow.webContents.send("update-font-size", message);
});
ipcMain.on("update-font-weight", (event) => {
  songWindow.webContents.send("update-font-weight");
});
ipcMain.on("toggle-dark-mode", (event) => {
  songWindow.webContents.send("toggle-dark-mode");
});
ipcMain.on("change-text-color", (event, color) => {
  songWindow.webContents.send("change-text-color", color);
});

app.on("ready", () => {
  screen.on("display-added", (event, newDisplay) => {
    let displays = screen.getAllDisplays();
    if (displays.length > 1) {
      let secondScreen = displays[1];
      console.log("secondScreen", displays[1]);
      songWindow.setBounds({
        width: secondScreen.size.width,
        height: secondScreen.size.height,
        x: secondScreen.bounds.x,
        y: secondScreen.bounds.y,
      });
      songWindow.show();
      songWindow.setFullScreen(true);
      songWindow.maximize();
      mainWindow.focus();
    }
  });
  screen.on("display-removed", () => {
    let displays = screen.getAllDisplays();
    console.log("all after remove", displays);
    if (displays.length == 1) {
      firstScreen = displays[0];
      songWindow.setFullScreen(false);
      songWindow.minimize();
      songWindow.hide();
      // songWindow.setBounds({
      //   width: 500,
      //   height: 400,
      //   x: firstScreen.bounds.x,
      //   y: firstScreen.bounds.y,
      // });
    }
  });
});

ipcMain.on("extend-song-window", (event) => {
  let displays = screen.getAllDisplays();
  if (displays.length > 1) {
    let secondScreen = displays[1];
    songWindow.setBounds({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
    });
    songWindow.setFullScreen(true);
  }
});

// verse number shortcut
ipcMain.on("shift-to-slide", (event, message) => {
  mainWindow.webContents.send("shift-to-slide", message);
});

// move screen when pressing up or down arrow
ipcMain.on("scroll-to-active", (event, message) => {
  // mainWindow.webContents.executeJavaScript(
  //   `window.scrollBy({top: ${message},left: 0,behavior : 'smooth'})`
  // );
  // mainWindow.webContents.executeJavaScript(
  //   `document.querySelector('.active').scrollIntoView({behavior: "smooth", block: "center", inline: "center" });
  //   `
  // );
});

ipcMain.on("update-version-message", (event, message) => {
  mainWindow.webContents.send("update-version-message", message);
});

ipcMain.handle("get-sibling-chapter", (event, message) => {
  // let prev = message[0]
  // let next = message[1]
  // console.log('prev chapter', bibleDB[prev])
  // console.log('next chapter', bibleDB[next])
  // console.log('get-sibling-chapter', message)
  // console.log('get-sibling-chapter', bibleDBIndexed[message])
  return bibleDBIndexed[message];
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// auto update

// app.on("ready", function () {
//   let currentVersion = app.getVersion();
//   updateVersionMessage(`Version: ${currentVersion}`);
//   autoUpdater.checkForUpdates();
// });
// autoUpdater.on("checking-for-update", () => {
//   updateVersionMessage("Checking for new version...");
// });
// autoUpdater.on("update-available", (info) => {
//   updateVersionMessage("New version available");
// });
// autoUpdater.on("update-not-available", (info) => {
//   let currentVersion = app.getVersion();
//   updateVersionMessage(`Up to date | Version: ${currentVersion}`);
// });
// autoUpdater.on("error", (err) => {
//   let currentVersion = app.getVersion();
//   updateVersionMessage(`Version: ${currentVersion} !`);
// });

// autoUpdater.on("download-progress", (progressObj) => {
//   let log_message = "Downloading: " + Math.floor(progressObj.percent) + "%";
//   updateVersionMessage(log_message);
// });
// autoUpdater.on("update-downloaded", (info) => {
//   updateVersionMessage(
//     "✅ Finished downloading, Restart the app to install updates."
//   );
//   mainWindow.webContents
//     .executeJavaScript(`document.querySelector('#installBtn').style.display = 'inline-block'
//   `);
//   // autoUpdater.quitAndInstall();
// });

// ipcMain.on("quit-and-install", () => {
//   console.log("closing");
//   autoUpdater.quitAndInstall();
// });

function loadFont(fontPath) {
  // Read the font file and convert it to Base64
  const fontData = fs.readFileSync(fontPath);
  return Buffer.from(fontData).toString("base64");
}

ipcMain.on("exportAllSongsToPDF", (event, waiting) => {
  const doc = new jsPDF({
    encoding: "UTF-8",
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Loop through each song in the 'waiting' array and generate PDF content
  waiting.forEach((song, index) => {
    const { title, chorus, verses, scale } = song.item;
    const fontPath = path.join(__dirname, "fonts", "amiri-Regular.ttf");
    const amiriFont = loadFont(fontPath);

    // Add the font to VFS and register it with jsPDF
    doc.addFileToVFS("Amiri-Regular.ttf", amiriFont);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri"); // Set the Amiri font
    doc.setLanguage("ar-EG"); // Arabic language setting

    const lineHeight = 15;

    // Add the song title and scale to the PDF
    doc.setFontSize(20);
    doc.text(`${title}`, doc.internal.pageSize.getWidth() / 2, 20, {
      align: "center",
      lang: "ar",
      // isInputRtl: true,
    });

    // Add chorus if it exists
    doc.setFontSize(18);
    if (chorus && chorus.length > 0) {
      const chorusLabelWidth =
        (doc.getStringUnitWidth("Chorus:") * doc.internal.getFontSize()) /
        doc.internal.scaleFactor;
      doc.text("القرار", doc.internal.pageSize.getWidth() / 2, 30);

      chorus.forEach((line, idx) => {
        const chorusLineWidth =
          (doc.getStringUnitWidth(`${idx + 1}. ${line}`) *
            doc.internal.getFontSize()) /
          doc.internal.scaleFactor;
        // Center the chorus line
        doc.text(
          line,
          doc.internal.pageSize.getWidth() / 2,
          50 + idx * lineHeight,
          {
            align: "center",
            lang: "ar",
          }
        );
      });

      // Add spacing after the chorus
      doc.text("", 10, 50 + chorus.length * 20); // Add an empty line after chorus
    }

    // Add verses if they exist
    if (verses && verses.length > 0) {
      let yOffset = 50 + chorus.length * lineHeight; // Adjust yOffset based on chorus length

      verses.forEach((verse, verseIndex) => {
        // Add spacing before each verse
        yOffset += lineHeight; // Add space before each verse
        doc.setFontSize(16);
        const verseLabelWidth =
          (doc.getStringUnitWidth(`${verseIndex + 1}:`) *
            doc.internal.getFontSize()) /
          doc.internal.scaleFactor;
        // Center the verse label
        doc.text(
          `${verseIndex + 1}`,
          doc.internal.pageSize.getWidth() / 2,
          yOffset,
          {
            align: "center",
            lang: "ar",
          }
        );

        verse.forEach((line, lineIndex) => {
          const lineWidth =
            (doc.getStringUnitWidth(`${line}`) * doc.internal.getFontSize()) /
            doc.internal.scaleFactor;
          // Center the verse line
          doc.text(
            line,
            doc.internal.pageSize.getWidth() / 2,
            yOffset + lineIndex * lineHeight,
            {
              align: "center",
              lang: "ar",
            }
          );
          yOffset += lineHeight; // Move down after verse number
        });

        // Add spacing after each verse
        yOffset += verse.length * 10 + lineHeight; // Add space after each verse
      });
    }

    // Add a new page if there are more songs
    if (index < waiting.length - 1) {
      doc.addPage();
    }
  });

  // Generate the PDF as a binary string
  const pdfOutput = doc.output();

  // Get the path to the user's Desktop
  const desktopPath = path.join(
    process.env.USERPROFILE,
    "Desktop",
    "songs.pdf"
  );

  // Write the PDF to the Desktop
  fs.writeFile(desktopPath, pdfOutput, "binary", (err) => {
    if (err) {
      console.error("Error writing PDF:", err);
    } else {
      console.log("PDF successfully saved to Desktop at", desktopPath);
    }
  });
});
