const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const Fuse = require("fuse.js");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}
console.time("MappingSongs");
const songsDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "tasbe7naDB.json"), "utf-8")
);

// Map your songs array and create searchable content for each song
const songsWithSearchableContent = songsDB.map((song) => {
  return {
    ...song,
    searchableContent: createSearchableContent(song),
  };
});
console.timeEnd("MappingSongs");

const fuse = new Fuse(songsWithSearchableContent, {
  includeScore: true,
  threshold: 0.2, // Adjust as needed
  minMatchCharLength: 2,
  ignoreLocation: true,
  tokenize: (input) => {
    return normalize(input).split(/\s+/); // Split on spaces
  },
  keys: ["searchableContent"],
});

// Function to create a searchable content string for each song
function createSearchableContent(song) {
  const { title, chorus, verses } = song;
  const chorusText = chorus ? chorus.join(" ") : "";
  const versesText = verses
    ? verses.map((verse) => verse.join(" ")).join(" ")
    : "";
  return normalize(`${title} ${chorusText} ${versesText}`);
}

// normalize text
function normalize(text) {
  return (
    text
      .replace(/أ|آ|إ|ا/g, "ا") // Treat أ, إ, and ا as the same
      .replace(/ى|ي/g, "ي")
      .replace(/ذ|ظ|ز/g, "ز")
      .replace(/ء|ؤ|ئ/g, "ء")
      // .replace(/َ|ً|ُ|ٌ|ِ|ٍ|ّ/g, "");
      .replace(/[ًٌٍَُِّ]/g, "")
  ); // Remove Arabic diacritics
}

// Function to search for songs
function searchSongs(event, term) {
  const normalizedTerm = normalize(term);
  const results = fuse.search(normalizedTerm);
  return results;
}

const handleSetTitle = (event, title) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.setTitle(title);
};
app.on("ready", () => {
  ipcMain.on("set-title", handleSetTitle);
  ipcMain.handle("search-songs", searchSongs);
});

let mainWindow;
const createMainWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

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
  const displays = screen.getAllDisplays();
  if (displays.length > 1) {
    const secondScreen = displays[1];
    songWindow = new BrowserWindow({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        preload: path.join(__dirname, "songPreload.js"),
      },
    });
    songWindow.setFullScreen(true);
  } else {
    songWindow = new BrowserWindow({
      width: 500,
      height: 400,
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

  songWindow.webContents.openDevTools();
};

app.on("ready", createMainWindow);
app.on("ready", createSongWindow);
app.on("ready", addIPCs);
function addIPCs() {
  ipcMain.on("update-song-window", (event, content) => {
    console.log("update song window");
    songWindow.webContents.send("load-content", content);
  });
  ipcMain.on("update-font-size", (event, fontSize) => {
    console.log("update font");
    songWindow.webContents.send("load-content", fontSize);
    songWindow.webContents.send("update-font", fontSize);
  });
}

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
