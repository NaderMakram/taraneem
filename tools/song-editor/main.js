"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { readDatabase, saveSong } = require("./store");
const { buildSearchIndex, searchIndexedSongs } = require("./search");

const databasePath = path.resolve(__dirname, "../../src/taraneemDB.json");
let window;
let cached;

function currentDatabase() {
  const stat = fs.statSync(databasePath);
  if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
    const database = readDatabase(databasePath);
    cached = { ...database, searchIndex: buildSearchIndex(database.songs), mtimeMs: stat.mtimeMs, size: stat.size };
  }
  return cached;
}

function fromEditor(event) {
  if (!window || event.sender !== window.webContents) throw new Error("طلب غير مسموح.");
}

app.setName("Taraneem Song Editor");

app.whenReady().then(() => {
  ipcMain.handle("editor:status", (event) => {
    fromEditor(event);
    const { songs, revision } = currentDatabase();
    return { count: songs.length, revision };
  });

  ipcMain.handle("editor:search", (event, query) => {
    fromEditor(event);
    if (typeof query !== "string" || query.length > 200) throw new Error("نص البحث غير صالح.");
    const { searchIndex, revision } = currentDatabase();
    return { results: searchIndexedSongs(searchIndex, query), revision };
  });

  ipcMain.handle("editor:get-song", (event, index) => {
    fromEditor(event);
    const { songs, revision } = readDatabase(databasePath);
    if (!Number.isInteger(index) || index < 0 || index >= songs.length) throw new Error("الترنيمة غير موجودة.");
    return { song: songs[index], revision };
  });

  ipcMain.handle("editor:save", (event, payload) => {
    fromEditor(event);
    try {
      const result = saveSong(databasePath, payload);
      cached = null;
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, code: error.code || "SAVE_FAILED", message: error.message };
    }
  });

  window = new BrowserWindow({
    title: "محرر ترانيم قاعدة البيانات",
    width: 1180,
    height: 830,
    minWidth: 780,
    minHeight: 600,
    backgroundColor: "#f6f4ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(__dirname, "index.html"));
});

app.on("window-all-closed", () => app.quit());
