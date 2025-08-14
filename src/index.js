const { app, BrowserWindow, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const isDev = require("electron-is-dev");
const path = require("path");
const fs = require("fs");

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Focus on the existing main window if another instance is opened
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let showDevTools = true;
let fastSearch = true;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

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
    type: "chapter",
  };
});

// Function to write the songs data to a JSON file

// normalize song text
// function normalize(text) {
//   return (
//     text
//       .replace(/أ|آ|إ/g, "ا") // Treat أ, إ, and ا as the same
//       .replace(/ى/g, "ي")
//       .replace(/ث/g, "س")
//       .replace(/ق/g, "ك")
//       .replace(/ه/g, "ة")
//       .replace(/ذ|ظ/g, "ز")
//       .replace(/ؤ|ئ/g, "ء")
//       // remove tashkeel
//       .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
//       // remove \n
//       .replace(/\n/g, " ")
//   );
// }

// function normalizeBibleVerse(text) {
//   return text
//     .replace(/أ|آ|إ/g, "ا")
//     .replace(/ى/g, "ي")
//     .replace(/ه/g, "ة")
//     .replace(/ؤ|ئ/g, "ء");
// }

// let fastFuseController;
// let deepFuseController;
// async function performSearch(normalizedTerm) {
//   // Abort any ongoing searches
//   if (fastFuseController) fastFuseController.abort();
//   if (deepFuseController) deepFuseController.abort();

//   // Create new AbortControllers for the new search
//   fastFuseController = new AbortController();
//   deepFuseController = new AbortController();

//   try {
//     // Start the fastFuse search with the abort signal
//     let results = await fastFuse.search(normalizedTerm, {
//       signal: fastFuseController.signal,
//     });

//     // If no results, start the deepFuse search with the abort signal
//     if (results.length === 0) {
//       results = await deepFuse.search(normalizedTerm, {
//         signal: deepFuseController.signal,
//       });
//     }

//     return results;
//   } catch (err) {
//     // Handle the abort error
//     if (err.name === "AbortError") {
//       console.log("Search aborted");
//     } else {
//       console.error("Search failed:", err);
//     }
//   }
// }

// Function to search for songs
// function searchSongs(event, term) {
//   let containsDigit = /\d/.test(term);

//   console.time("searching time");
//   // console.log(BrowserWindow.getAllWindows());
//   // console.log(fastSearch);
//   let results;
//   if (containsDigit) {
//     // do bible search
//     let termWithoutSpaces = term.replace(/\s+/g, "");
//     let book_and_chapter = termWithoutSpaces.match(
//       /(?:\b\d+)?[\u0600-\u06FF]+/
//     );
//     if (book_and_chapter) {
//       let normalizedVerse = normalizeBibleVerse(book_and_chapter[0]);
//       // fix for searching with common spelling
//       if (normalizedVerse === "مزمور") {
//         normalizedVerse = "مز";
//       }
//       results = bibleShortFuse.search("=" + normalizedVerse);
//       if (results.length === 0) {
//         results = bibleLongFuse.search(normalizedVerse);
//       }
//     }
//   } else {
//     // do song search
//     let normalizedTerm = normalize(term);
//     if (fastSearch) {
//       // results = fastFuse.search(normalizedTerm);
//       // if (results.length === 0) {
//       //   results = deepFuse.search(normalizedTerm);
//       // }
//       results = performSearch(normalizedTerm);
//     } else {
//       results = deepFuse.search(normalizedTerm);
//     }
//   }

//   console.timeEnd("searching time");
//   return results;
// }

// const handleSetTitle = (event, title) => {
//   const webContents = event.sender;
//   const win = BrowserWindow.fromWebContents(webContents);
//   win.setTitle(title);
// };

// function readJson() {
//   return JSON.parse(
//     fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
//   );
// }

// app.on("ready", () => {
//   ipcMain.on("set-title", handleSetTitle);
//   ipcMain.handle("search-songs", async (event, term) => {
//     // Post data to the worker
//     worker.postMessage({ term });
//   });
//   ipcMain.on("flip-searching-mode", () => {
//     fastSearch = !fastSearch;
//   });
//   ipcMain.handle("read-json", readJson);
//   console.log(fastSearch);
// });

let mainWindow;
let songWindow;
let thirdWindow;

const createMainWindow = () => {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  // Calculate main window size (2/3 of screen width for single display)
  const displays = screen.getAllDisplays();
  let windowWidth, windowHeight, windowX, windowY;

  if (displays.length > 1) {
    // Dual display setup - use primary display
    windowWidth = screenWidth;
    windowHeight = screenHeight;
    windowX = 0;
    windowY = 0;
  } else {
    // Single display setup - use 2/3 of width
    windowWidth = Math.floor((screenWidth * 2) / 3);
    windowHeight = screenHeight;
    windowX = 0;
    windowY = 0;
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    resizable: displays.length > 1, // Only resizable in dual display mode
    movable: displays.length > 1, // Only movable in dual display mode
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

  if (displays.length > 1) {
    mainWindow.maximize();
  }

  mainWindow.show();
  mainWindow.focus();

  // remove menu
  mainWindow.removeMenu();

  if (isDev && showDevTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    app.quit();
  });
};

const createSongWindow = () => {
  let displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  if (displays.length > 1) {
    // Dual display setup - use second screen
    const secondScreen = displays[1];
    songWindow = new BrowserWindow({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      icon: path.join(__dirname, "assets", "taraneem logo transparent.png"),
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
      frame: false,
      alwaysOnTop: false,
      resizable: true,
      movable: true,
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        preload: path.join(__dirname, "songPreload.js"),
      },
    });
    songWindow.setFullScreen(true);
  } else {
    // Single display setup - use 1/3 of screen width, positioned on the right
    const mainWindowWidth = Math.floor((screenWidth * 2) / 3);
    const songWindowWidth = screenWidth - mainWindowWidth; // Ensure perfect fit
    const songWindowX = mainWindowWidth;

    songWindow = new BrowserWindow({
      show: false,
      frame: false,
      width: songWindowWidth,
      height: screenHeight,
      x: songWindowX,
      y: 0,
      resizable: false, // Prevent resizing in snap mode
      movable: false, // Prevent moving in snap mode
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

  // Always show the song window
  songWindow.show();

  if (isDev) {
    // songWindow.hide();
  }

  // remove menu
  songWindow.on("closed", () => {
    app.quit();
  });
  if (isDev && showDevTools) {
    songWindow.webContents.openDevTools();
  }
};

// create third window for singers
const createThirdWindow = () => {
  let displays = screen.getAllDisplays();

  if (displays.length > 2) {
    const thirdScreen = displays[2];

    thirdWindow = new BrowserWindow({
      width: thirdScreen.size.width,
      height: thirdScreen.size.height,
      x: thirdScreen.bounds.x,
      y: thirdScreen.bounds.y,
      frame: false,
      alwaysOnTop: false,
      resizable: true, // Change to true for fullscreen
      movable: true, // Change to true for fullscreen
      icon: path.join(__dirname, "assets", "taraneem logo transparent.png"),
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, "songPreload.js"),
      },
    });

    // Remove duplicate setFullScreen call - do it once
    thirdWindow.setFullScreen(true);

    thirdWindow.removeMenu();
    thirdWindow.loadFile(path.join(__dirname, "singers.html"));
    thirdWindow.show();

    thirdWindow.on("closed", () => {
      thirdWindow = null; // Clean up reference
    });

    if (isDev && showDevTools) {
      thirdWindow.webContents.openDevTools();
    }
  }
};

// update version message
function updateVersionMessage(message) {
  mainWindow.webContents.executeJavaScript(
    `document.querySelector('#version').innerHTML=("${message}")`
  );
  mainWindow.webContents.send("log", message);
}

app.on("ready", createSongWindow);
app.on("ready", createMainWindow);
app.on("ready", addIPCs);

app.on("ready", () => {
  mainWindow.webContents
    .executeJavaScript("({...localStorage});", true)
    .then((localStorage) => {
      if (localStorage.dark_mode == "true") {
        // console.log(`dark mode: ${localStorage.dark_mode}`);
        // ipcMain.emit("toggle-dark-mode");
        mainWindow.webContents.executeJavaScript(
          `
          document.querySelector("input#dark_mode_input").click()
          `
        );
      }
      manageDisplays();
      mainWindow.focus();
    });
});

function addIPCs() {
  ipcMain.on("update-song-window", (event, content, isBible) => {
    songWindow.webContents.send("update-song-window", content, isBible);
    if (thirdWindow) {
      thirdWindow.webContents.send("update-song-window", content, isBible);
    }
    if (content != "") {
      mainWindow.webContents.executeJavaScript(
        `
        element = document.querySelector('.active');
        if(element){

          elementRect = element.getBoundingClientRect();
          absoluteElementTop = elementRect.top + window.pageYOffset;
          middle = absoluteElementTop - (window.innerHeight / 3);
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
  thirdWindow
    ? thirdWindow.webContents.send("update-font-size", message)
    : null;
});
// ipcMain.on("update-font-weight", (event) => {
//   songWindow.webContents.send("update-font-weight");
//   thirdWindow ? thirdWindow.webContents.send("update-font-weight") : null;
// });
ipcMain.on("toggle-dark-mode", (event, message) => {
  songWindow.webContents.send("toggle-dark-mode");
  thirdWindow ? thirdWindow.webContents.send("toggle-dark-mode") : null;
});

// Update manageDisplays function to handle third window
let manageDisplays = () => {
  let displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  if (displays.length === 1) {
    mainWindow.webContents.send("show-extend-notice");
  } else {
    mainWindow.webContents.send("hide-extend-notice");
  }

  if (displays.length > 2) {
    // ≥3 displays case
    let secondScreen = displays[1];
    let thirdScreen = displays[2];

    // Main window on primary display
    mainWindow.setBounds({
      width: screenWidth,
      height: screenHeight,
      x: 0,
      y: 0,
    });
    mainWindow.maximize();

    // Song window on second screen
    songWindow.setBounds({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
    });
    songWindow.setFullScreen(true);

    // Third window on third screen
    if (!thirdWindow) {
      createThirdWindow();
    } else {
      thirdWindow.setBounds({
        width: thirdScreen.size.width,
        height: thirdScreen.size.height,
        x: thirdScreen.bounds.x,
        y: thirdScreen.bounds.y,
      });
      thirdWindow.setFullScreen(true);
    }

    // Show swap button
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('swapExternalWindows').style.display = 'inline-block';
    `);
  } else if (displays.length === 2) {
    // Exactly 2 displays case
    let secondScreen = displays[1];

    mainWindow.setBounds({
      width: screenWidth,
      height: screenHeight,
      x: 0,
      y: 0,
    });
    mainWindow.maximize();

    // Song window on second display
    songWindow.setBounds({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
    });
    songWindow.setFullScreen(true);

    // Close thirdWindow if open
    if (thirdWindow) {
      thirdWindow.close();
      thirdWindow = null;
    }

    // Hide swap button
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('swapExternalWindows').style.display = 'none';
    `);
  } else {
    // Single display case - snapped view
    const mainWindowWidth = Math.floor((screenWidth * 2) / 3);
    const songWindowWidth = screenWidth - mainWindowWidth;
    const songWindowX = mainWindowWidth;

    // Make sure both windows are not fullscreen
    mainWindow.setFullScreen(false);
    songWindow.setFullScreen(false);

    // Make them fixed in place like before
    mainWindow.setResizable(false);
    mainWindow.setMovable(false);
    songWindow.setResizable(false);
    songWindow.setMovable(false);

    // Main window on left 2/3
    mainWindow.setBounds({
      width: mainWindowWidth,
      height: screenHeight,
      x: 0,
      y: 0,
    });

    // Song window on right 1/3
    songWindow.setBounds({
      width: songWindowWidth,
      height: screenHeight,
      x: songWindowX,
      y: 0,
    });

    songWindow.show();

    // Close thirdWindow if open
    if (thirdWindow) {
      thirdWindow.close();
      thirdWindow = null;
    }

    // Hide swap button
    mainWindow.webContents.executeJavaScript(`
    document.getElementById('swapExternalWindows').style.display = 'none';
  `);
  }

  mainWindow.focus();
};

app.on("ready", () => {
  screen.on("display-added", (event, newDisplay) => {
    manageDisplays();
  });
  screen.on("display-removed", () => {
    manageDisplays();
  });
});

let swapped = false;
ipcMain.on("swap-external-windows", () => {
  const displays = screen.getAllDisplays();
  if (displays.length > 2 && songWindow && thirdWindow) {
    const secondScreen = displays[1];
    const thirdScreen = displays[2];

    if (!swapped) {
      // Swap positions
      songWindow.setBounds({
        width: thirdScreen.size.width,
        height: thirdScreen.size.height,
        x: thirdScreen.bounds.x,
        y: thirdScreen.bounds.y,
      });
      thirdWindow.setBounds({
        width: secondScreen.size.width,
        height: secondScreen.size.height,
        x: secondScreen.bounds.x,
        y: secondScreen.bounds.y,
      });
      swapped = true;
    } else {
      // Swap back
      songWindow.setBounds({
        width: secondScreen.size.width,
        height: secondScreen.size.height,
        x: secondScreen.bounds.x,
        y: secondScreen.bounds.y,
      });
      thirdWindow.setBounds({
        width: thirdScreen.size.width,
        height: thirdScreen.size.height,
        x: thirdScreen.bounds.x,
        y: thirdScreen.bounds.y,
      });
      swapped = false;
    }

    songWindow.setFullScreen(true);
    thirdWindow.setFullScreen(true);
  }
});

// verse number shortcut
ipcMain.on("shift-to-slide", (event, message) => {
  mainWindow.webContents.send("shift-to-slide", message);
});

ipcMain.on("update-version-message", (event, message) => {
  mainWindow.webContents.send("update-version-message", message);
});

ipcMain.handle("get-sibling-chapter", (event, message) => {
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

app.on("ready", function () {
  let currentVersion = app.getVersion();
  updateVersionMessage(`Version: ${currentVersion}`);
  autoUpdater.checkForUpdates();
});
autoUpdater.on("checking-for-update", () => {
  updateVersionMessage("Checking for new version...");
});
autoUpdater.on("update-available", (info) => {
  updateVersionMessage("New version available");
});
autoUpdater.on("update-not-available", (info) => {
  let currentVersion = app.getVersion();
  updateVersionMessage(`Up to date | Version: ${currentVersion}`);
});
autoUpdater.on("error", (err) => {
  let currentVersion = app.getVersion();
  updateVersionMessage(`Version: ${currentVersion} !`);
});

autoUpdater.on("download-progress", (progressObj) => {
  let log_message = "Downloading: " + Math.floor(progressObj.percent) + "%";
  updateVersionMessage(log_message);
});
autoUpdater.on("update-downloaded", (info) => {
  updateVersionMessage(
    "✅ Finished downloading, Restart the app to install updates."
  );
  mainWindow.webContents
    .executeJavaScript(`document.querySelector('#installBtn').style.display = 'inline-block'
  `);
  // autoUpdater.quitAndInstall();
});

ipcMain.on("quit-and-install", () => {
  console.log("closing");
  autoUpdater.quitAndInstall();
});
