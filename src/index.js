const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const isDev = require("electron-is-dev");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const analytics = require("./analytics/analyticsService");
const analyticsDebug = require("./analytics/analyticsDebug");
const {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE_BYTES,
  createThemeStore,
  readImageDimensions,
} = require("./themeStore");
const {
  RELEASES_PAGE_URL,
  checkForMacUpdate: checkForManualMacUpdate,
} = require("./update/manualUpdate");

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

let fastSearch = true;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const bibleDB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "bible_normalized.json"), "utf-8")
);
const userDataPath = app.getPath("userData");
const localDBPath = path.join(userDataPath, "localTaraneemDB.json");
const themeStore = createThemeStore(userDataPath);

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
      .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
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

// const handleSetTitle = (event, title) => {
//   const webContents = event.sender;
//   const win = BrowserWindow.fromWebContents(webContents);
//   win.setTitle(title);
// };

function readJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
  );
}
app.on("ready", () => {
  // ipcMain.on("set-title", handleSetTitle);
  // ipcMain.handle("search-songs", async (event, term) => {
  //   // Post data to the worker
  //   worker.postMessage({ term });
  // });
  // ipcMain.on("flip-searching-mode", () => {
  //   fastSearch = !fastSearch;
  // });
  ipcMain.handle("read-json", readJson);
});

let mainWindow;
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

  const userDataPath = app.getPath("userData");

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
      additionalArguments: [`--userDataPath=${userDataPath}`],
    },
    backgroundColor: "#f9f9f9", // Match loader background
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  if (displays.length > 1) {
    mainWindow.maximize();
  }

  // Optimized showing to prevent white flash
  mainWindow.once("ready-to-show", () => {
    analyticsDebug.setMainWindow(mainWindow);
    mainWindow.show();
    mainWindow.focus();
  });
  // mainWindow.show();
  // mainWindow.focus();

  // remove menu
  mainWindow.removeMenu();

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    app.quit();
  });
};

// song window
let songWindow;

const DEFAULT_THEME_ID = "dark";
const BUILT_IN_THEME_IDS = new Set([
  "light",
  "dark",
  "black",
  "wedding1",
  "wedding2",
  "christmas",
  "christmas-simple",
  "christmas-dark",
  "christmas-dark-simple",
  "elsoora-light",
  "elsoora-dark",
]);
const THEME_IMAGE_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_THEME_IMAGE_DIMENSION = 8192;
const MAX_THEME_IMAGE_PIXELS = 40 * 1000 * 1000;
const approvedThemeImages = new Map();
let activeThemeId = DEFAULT_THEME_ID;

function createImageToken() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return crypto.randomBytes(24).toString("hex");
}

function resolveThemePayload(themeId) {
  const normalizedId = typeof themeId === "string" ? themeId.trim() : "";
  if (BUILT_IN_THEME_IDS.has(normalizedId)) {
    return { version: 1, kind: "builtin", id: normalizedId };
  }

  const customTheme = normalizedId ? themeStore.getTheme(normalizedId) : null;
  if (customTheme) {
    return { version: 1, kind: "custom", ...customTheme };
  }

  return { version: 1, kind: "builtin", id: DEFAULT_THEME_ID };
}

function applyThemeSelection(themeId) {
  const payload = resolveThemePayload(themeId);
  activeThemeId = payload.id;

  if (
    songWindow &&
    !songWindow.isDestroyed() &&
    !songWindow.webContents.isLoadingMainFrame()
  ) {
    songWindow.webContents.send("set-theme", payload);
  }

  return payload;
}

function pruneExpiredThemeImageTokens(now = Date.now()) {
  for (const [token, approval] of approvedThemeImages.entries()) {
    if (approval.expiresAt <= now || approval.webContents.isDestroyed()) {
      approvedThemeImages.delete(token);
    }
  }
}

function detectThemeImageType(filePath) {
  const fileDescriptor = fs.openSync(filePath, "r");
  const signature = Buffer.alloc(12);
  let bytesRead;
  try {
    bytesRead = fs.readSync(fileDescriptor, signature, 0, signature.length, 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  if (
    bytesRead >= 8 &&
    signature.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return ".png";
  }
  if (
    bytesRead >= 3 &&
    signature[0] === 0xff &&
    signature[1] === 0xd8 &&
    signature[2] === 0xff
  ) {
    return ".jpeg";
  }
  if (
    bytesRead >= 12 &&
    signature.subarray(0, 4).toString("ascii") === "RIFF" &&
    signature.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  return null;
}

function isAllowedThemeImageSize(dimensions) {
  const width = dimensions?.width;
  const height = dimensions?.height;
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_THEME_IMAGE_DIMENSION &&
    height <= MAX_THEME_IMAGE_DIMENSION &&
    width * height <= MAX_THEME_IMAGE_PIXELS
  );
}

function validateThemeImageFile(selectedPath) {
  if (typeof selectedPath !== "string" || !selectedPath) {
    throw new Error("اختر صورة للخلفية");
  }

  const extension = path.extname(selectedPath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP");
  }

  let resolvedPath;
  let stats;
  try {
    resolvedPath = fs.realpathSync(selectedPath);
    stats = fs.statSync(resolvedPath);
  } catch (error) {
    throw new Error("تعذر قراءة صورة الخلفية");
  }

  if (!stats.isFile() || stats.size === 0) {
    throw new Error("ملف صورة الخلفية غير صالح");
  }
  if (stats.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("حجم الصورة يجب ألا يتجاوز 20 ميجابايت");
  }

  let detectedType;
  try {
    detectedType = detectThemeImageType(resolvedPath);
  } catch (error) {
    throw new Error("تعذر قراءة محتوى صورة الخلفية");
  }
  const extensionMatches =
    detectedType === extension ||
    (detectedType === ".jpeg" && [".jpg", ".jpeg"].includes(extension));
  if (!extensionMatches) {
    throw new Error("محتوى الصورة لا يطابق صيغتها");
  }

  let declaredDimensions;
  try {
    declaredDimensions = readImageDimensions(resolvedPath, detectedType);
  } catch (error) {
    throw new Error("تعذر قراءة أبعاد صورة الخلفية");
  }
  if (!isAllowedThemeImageSize(declaredDimensions)) {
    throw new Error("أبعاد الصورة كبيرة جدًا أو غير صالحة");
  }

  let image;
  try {
    image = nativeImage.createFromPath(resolvedPath);
  } catch (error) {
    throw new Error("تعذر فتح الصورة المختارة");
  }
  if (!image || image.isEmpty()) {
    throw new Error("تعذر فتح الصورة المختارة");
  }

  const { width, height } = image.getSize();
  if (!isAllowedThemeImageSize({ width, height })) {
    throw new Error("أبعاد الصورة كبيرة جدًا أو غير صالحة");
  }

  const previewScale = Math.min(1, 1600 / width, 900 / height);
  const previewImage =
    previewScale < 1
      ? image.resize({
          width: Math.max(1, Math.round(width * previewScale)),
          height: Math.max(1, Math.round(height * previewScale)),
          quality: "good",
        })
      : image;

  return {
    fileName: path.basename(resolvedPath),
    height,
    previewUrl: previewImage.toDataURL(),
    resolvedPath,
    width,
  };
}

function getApprovedThemeImage(event, imageToken) {
  pruneExpiredThemeImageTokens();
  if (typeof imageToken !== "string" || !imageToken) {
    throw new Error("اختر صورة الخلفية مرة أخرى");
  }

  const approval = approvedThemeImages.get(imageToken);
  if (!approval || approval.webContents !== event.sender) {
    throw new Error("انتهت صلاحية اختيار الصورة. اخترها مرة أخرى");
  }

  return validateThemeImageFile(approval.sourcePath);
}

function isMainWindowThemeSender(event) {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      event?.sender === mainWindow.webContents
  );
}

function assertMainWindowThemeSender(event) {
  if (!isMainWindowThemeSender(event)) {
    throw new Error("Unauthorized theme IPC sender");
  }
}

const createSongWindow = () => {
  let displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  if (displays.length > 1) {
    // Dual display setup - use second screen
    const secondScreen = displays[1];
    songWindow = new BrowserWindow({
      show: false,
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
  songWindow.webContents.on("did-finish-load", () => {
    applyThemeSelection(activeThemeId);
  });
  // and load the index.html of the app.
  songWindow.loadFile(path.join(__dirname, "song.html"));

  // Always show the song window
  // songWindow.show();

  if (isDev) {
    // songWindow.hide();
  }

  // remove menu
  songWindow.on("closed", () => {
    app.quit();
  });
  if (isDev) {
    songWindow.webContents.openDevTools();
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
  analytics.setup({
    userDataPath,
    getAppVersion: () => app.getVersion(),
    getLocale: () => app.getLocale(),
    getDisplayCount: () => screen.getAllDisplays().length,
  });
});
app.on("ready", () => {
  // 1. Get localStorage data from the renderer
  mainWindow.webContents
    .executeJavaScript("({...localStorage});", true)
    .then((localStorage) => {
      if (localStorage.theme) {
        const resolvedTheme = applyThemeSelection(localStorage.theme);
        const resolvedThemeId = JSON.stringify(resolvedTheme.id);
        const setSelectScript = `
          const resolvedThemeId = ${resolvedThemeId};
          localStorage.setItem("theme", resolvedThemeId);
          const themeSelect = document.querySelector("#theme_select");
          if (
            themeSelect &&
            Array.from(themeSelect.options).some(
              (option) => option.value === resolvedThemeId
            )
          ) {
            themeSelect.value = resolvedThemeId;
          }
        `;

        mainWindow.webContents.executeJavaScript(setSelectScript);
      } else {
        applyThemeSelection(DEFAULT_THEME_ID);
      }

    });
});

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
});
ipcMain.on("update-font-weight", (event) => {
  songWindow.webContents.send("update-font-weight");
});

ipcMain.handle("themes:list", () => themeStore.listThemes());

ipcMain.handle("themes:get", (_event, themeId) => themeStore.getTheme(themeId));

ipcMain.handle("themes:choose-image", async (event) => {
  assertMainWindowThemeSender(event);
  const ownerWindow = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: "اختيار صورة خلفية",
    buttonLabel: "اختيار الصورة",
    properties: ["openFile"],
    filters: [
      {
        name: "الصور",
        extensions: ["png", "jpg", "jpeg", "webp"],
      },
    ],
  };
  const result = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length !== 1) {
    return { canceled: true };
  }

  const selectedImage = validateThemeImageFile(result.filePaths[0]);
  if (event.sender.isDestroyed()) return { canceled: true };

  pruneExpiredThemeImageTokens();
  const imageToken = createImageToken();
  approvedThemeImages.set(imageToken, {
    expiresAt: Date.now() + THEME_IMAGE_TOKEN_TTL_MS,
    sourcePath: selectedImage.resolvedPath,
    webContents: event.sender,
  });

  return {
    canceled: false,
    imageToken,
    previewUrl: selectedImage.previewUrl,
    fileName: selectedImage.fileName,
    width: selectedImage.width,
    height: selectedImage.height,
  };
});

ipcMain.handle("themes:save", (event, theme, imageToken = null) => {
  assertMainWindowThemeSender(event);
  let approvedImage = null;
  if (theme?.background?.type === "image" && imageToken) {
    approvedImage = getApprovedThemeImage(event, imageToken);
  }

  let savedTheme;
  try {
    savedTheme = themeStore.saveTheme(
      theme,
      approvedImage?.resolvedPath || null
    );
  } catch (error) {
    if (error?.code) {
      console.error("Failed to persist a custom theme", error);
      throw new Error("تعذر حفظ الخلفية في ملفات التطبيق");
    }
    throw error;
  }

  if (imageToken) {
    const approval = approvedThemeImages.get(imageToken);
    if (approval?.webContents === event.sender) {
      approvedThemeImages.delete(imageToken);
    }
  }

  if (activeThemeId === savedTheme.id) {
    applyThemeSelection(savedTheme.id);
  }

  return savedTheme;
});

ipcMain.handle("themes:delete", (event, themeId) => {
  assertMainWindowThemeSender(event);
  let deleted;
  try {
    deleted = themeStore.deleteTheme(themeId);
  } catch (error) {
    console.error("Failed to delete a custom theme", error);
    throw new Error("تعذر حذف الخلفية من ملفات التطبيق");
  }
  if (deleted && activeThemeId === themeId) {
    applyThemeSelection(DEFAULT_THEME_ID);
  }
  return deleted;
});

ipcMain.handle("themes:apply", (event, themeId) => {
  assertMainWindowThemeSender(event);
  return applyThemeSelection(themeId);
});

ipcMain.on("set-theme", (event, theme) => {
  if (!isMainWindowThemeSender(event)) return;
  applyThemeSelection(theme);
});

let manageDisplays = () => {
  let displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  if (displays.length > 1) {
    // Dual display setup
    let secondScreen = displays[1];

    // Remove snap behavior for dual display
    mainWindow.setResizable(true);
    songWindow.setResizable(true);

    // Main window on primary display (fullscreen)
    mainWindow.setBounds({
      width: screenWidth,
      height: screenHeight,
      x: 0,
      y: 0,
    });
    mainWindow.maximize();

    // Song window on second display (fullscreen)
    songWindow.setBounds({
      width: secondScreen.size.width,
      height: secondScreen.size.height,
      x: secondScreen.bounds.x,
      y: secondScreen.bounds.y,
    });
    songWindow.setFullScreen(true);
    // songWindow.show();

    mainWindow.focus();
  } else {
    // Single display setup - snapped side by side
    const mainWindowWidth = Math.floor((screenWidth * 2) / 3);
    const songWindowWidth = screenWidth - mainWindowWidth; // Ensure no gaps
    const songWindowX = mainWindowWidth;

    // Make windows non-resizable to maintain snap behavior
    mainWindow.setResizable(false);
    songWindow.setResizable(false);

    // Main window takes 2/3 of screen - snapped to left
    mainWindow.setBounds({
      width: mainWindowWidth,
      height: screenHeight,
      x: 0,
      y: 0,
    });

    // Song window takes remaining space - snapped to right
    songWindow.setFullScreen(false);
    songWindow.setBounds({
      width: songWindowWidth,
      height: screenHeight,
      x: songWindowX,
      y: 0,
    });
    // songWindow.show();

    // Prevent windows from being moved when snapped
    mainWindow.setMovable(false);
    songWindow.setMovable(false);

    mainWindow.focus();
  }
};

app.on("ready", () => {
  screen.on("display-added", (event, newDisplay) => {
    manageDisplays();
  });
  screen.on("display-removed", () => {
    manageDisplays();
  });

  ipcMain.on("app-ready", () => {
    analytics.startSession();
    if (songWindow) {
      songWindow.show();
    }
    // First sync shortly after startup (debug logs in DevTools console)
    setTimeout(() => {
      analytics.forceSync().then((result) => {
        analyticsDebug.log("info", "Startup sync result", result);
      });
    }, 3000);
  });
});

ipcMain.on("analytics:track-presentation", (_event, meta) => {
  analytics.trackPresentation(meta);
});

ipcMain.handle("analytics:force-sync", async () => {
  const result = await analytics.forceSync();
  return { result, status: analytics.getDebugStatus() };
});

ipcMain.handle("analytics:debug-status", () => analytics.getDebugStatus());

app.on("before-quit", () => {
  analytics.endSession();
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
// saving songs to local json file

ipcMain.handle("save-song", async (event, song) => {
  ensureLocalDB();

  let songs = [];
  try {
    const raw = fs.readFileSync(localDBPath, "utf-8");
    songs = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse localTaraneemDB.json", e);
  }

  // Add metadata
  const now = new Date().toISOString();
  const newSong = {
    id: Date.now().toString(), // simple unique id
    dateCreated: now,
    dateEdited: now,
    uploaded: false,
    ...song,
  };

  songs.push(newSong);

  fs.writeFileSync(localDBPath, JSON.stringify(songs, null, 2), "utf-8");

  analytics.trackLocalSong("create", newSong);

  return newSong;
});

function ensureLocalDB() {
  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Create file if missing
  if (!fs.existsSync(localDBPath)) {
    fs.writeFileSync(localDBPath, JSON.stringify([], null, 2), "utf-8");
  }
}

ipcMain.handle("get-local-songs", async (event) => {
  ensureLocalDB();
  try {
    const raw = fs.readFileSync(localDBPath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse localTaraneemDB.json", e);
    return [];
  }
});

ipcMain.handle("get-song", async (event, songId) => {
  ensureLocalDB();
  const songs = JSON.parse(fs.readFileSync(localDBPath, "utf-8"));
  return songs[songId];
});

ipcMain.handle("update-song", async (event, songId, updatedSong) => {
  ensureLocalDB();
  let songs = JSON.parse(fs.readFileSync(localDBPath, "utf-8"));
  songs[songId] = {
    ...songs[songId],
    ...updatedSong,
    dateEdited: new Date().toISOString(),
  };
  fs.writeFileSync(localDBPath, JSON.stringify(songs, null, 2), "utf-8");
  analytics.trackLocalSong("update", songs[songId]);
  return songs[songId];
});

ipcMain.handle("delete-song", async (event, songId) => {
  ensureLocalDB();
  let songs = JSON.parse(fs.readFileSync(localDBPath, "utf-8"));
  const removed = songs[songId];
  if (removed) {
    analytics.trackLocalSong("delete", removed);
  }
  songs.splice(songId, 1);
  fs.writeFileSync(localDBPath, JSON.stringify(songs, null, 2), "utf-8");
  return true;
});

ipcMain.handle("get-version", () => {
  return app.getVersion();
});

// auto update

const MAC_UPDATE_CACHE_MS = 15 * 60 * 1000;
let macUpdateCheckPromise = null;
let macUpdateCheckedAt = 0;
let updateStatus = {
  platform: process.platform,
  state: "idle",
  currentVersion: app.getVersion(),
  latestVersion: null,
  downloadUrl: null,
};

function publishUpdateStatus(state, details = {}) {
  updateStatus = {
    ...updateStatus,
    ...details,
    platform: process.platform,
    state,
    currentVersion: app.getVersion(),
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", updateStatus);
  }

  return updateStatus;
}

async function checkMacUpdateAvailability() {
  if (process.platform !== "darwin") return updateStatus;
  if (macUpdateCheckPromise) return macUpdateCheckPromise;

  const cacheIsFresh =
    macUpdateCheckedAt > 0 &&
    Date.now() - macUpdateCheckedAt < MAC_UPDATE_CACHE_MS;
  if (cacheIsFresh) return updateStatus;

  publishUpdateStatus("checking", {
    latestVersion: null,
    downloadUrl: null,
    error: null,
  });
  updateVersionMessage("Checking for new version...");

  macUpdateCheckPromise = checkForManualMacUpdate(app.getVersion())
    .then((status) => {
      publishUpdateStatus(status.state, status);
      updateVersionMessage(
        status.state === "available"
          ? "New version available: " + status.latestVersion
          : "Up to date | Version: " + app.getVersion()
      );
      return updateStatus;
    })
    .catch((error) => {
      console.error("macOS update check failed:", error);
      publishUpdateStatus("error", {
        latestVersion: null,
        downloadUrl: RELEASES_PAGE_URL,
        error: error.message,
      });
      updateVersionMessage("Version: " + app.getVersion() + " !");
      return updateStatus;
    })
    .finally(() => {
      macUpdateCheckedAt = Date.now();
      macUpdateCheckPromise = null;
    });

  return macUpdateCheckPromise;
}

ipcMain.handle("get-update-status", () => updateStatus);
ipcMain.handle("refresh-update-status", () => checkMacUpdateAvailability());
ipcMain.handle("open-update-download", async () => {
  if (process.platform !== "darwin") return false;

  const downloadUrl = updateStatus.downloadUrl || RELEASES_PAGE_URL;
  try {
    const parsedUrl = new URL(downloadUrl);
    if (parsedUrl.protocol !== "https:") return false;
    await shell.openExternal(parsedUrl.toString());
    return true;
  } catch (error) {
    console.error("Failed to open the macOS download page:", error);
    return false;
  }
});

app.on("ready", function () {
  const currentVersion = app.getVersion();
  updateVersionMessage("Version: " + currentVersion);
  if (process.platform === "win32") {
    autoUpdater.checkForUpdates();
  } else if (process.platform === "darwin") {
    checkMacUpdateAvailability();
  }
});

autoUpdater.on("checking-for-update", () => {
  publishUpdateStatus("checking", {
    latestVersion: null,
    downloadUrl: null,
    error: null,
  });
  updateVersionMessage("Checking for new version...");
});

autoUpdater.on("update-available", (info) => {
  publishUpdateStatus("available", {
    latestVersion: info?.version || null,
    downloadUrl: null,
    error: null,
  });
  updateVersionMessage("New version available");
});

autoUpdater.on("update-not-available", () => {
  const currentVersion = app.getVersion();
  publishUpdateStatus("up-to-date", {
    latestVersion: currentVersion,
    downloadUrl: null,
    error: null,
  });
  updateVersionMessage("Up to date | Version: " + currentVersion);
});

autoUpdater.on("error", (error) => {
  const currentVersion = app.getVersion();
  publishUpdateStatus("error", {
    latestVersion: null,
    downloadUrl: null,
    error: error?.message || String(error),
  });
  updateVersionMessage("Version: " + currentVersion + " !");
});

autoUpdater.on("download-progress", (progress) => {
  const percent = Math.floor(progress.percent);
  publishUpdateStatus("downloading", {
    latestVersion: updateStatus.latestVersion,
    downloadUrl: null,
    percent,
  });
  updateVersionMessage("Downloading: " + percent + "%");
});

autoUpdater.on("update-downloaded", (info) => {
  publishUpdateStatus("downloaded", {
    latestVersion: info?.version || updateStatus.latestVersion,
    downloadUrl: null,
    percent: 100,
  });
  updateVersionMessage(
    "✅ Finished downloading, Restart the app to install updates."
  );
  mainWindow.webContents.executeJavaScript(
    `document.querySelector("#installBtn").style.display = "inline-block"`
  );
});

ipcMain.on("quit-and-install", () => {
  if (process.platform === "win32") {
    console.log("closing");
    autoUpdater.quitAndInstall();
  }
});
