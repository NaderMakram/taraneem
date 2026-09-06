const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "bible_normalized.json"), "utf8"));
const chapters = raw.map((chapter, index) => ({
  ...chapter,
  siblings: [index > 0 ? index - 1 : null, index + 1 < raw.length ? index + 1 : null],
  custom_ref: `chapter-${index}`,
}));

contextBridge.exposeInMainWorld("myCustomAPI", {
  livestream: {
    getStatus: () => ipcRenderer.invoke("livestream:get-status"),
    applySettings: settings => ipcRenderer.invoke("livestream:apply-settings", settings),
    setVisible: visible => ipcRenderer.invoke("livestream:set-visible", visible),
    openPreview: () => ipcRenderer.invoke("livestream:open-preview"),
    publish: payload => ipcRenderer.send("livestream:publish", payload),
    clear: () => ipcRenderer.send("livestream:clear"),
    onStatus: callback => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("livestream:status", listener);
      return () => ipcRenderer.removeListener("livestream:status", listener);
    },
  },
  updateSongWindow: (content, isBible) => ipcRenderer.send("update-song-window", content, isBible),
  getSiblingChapter: index => Number.isInteger(index) ? chapters[index] : undefined,
  trackPresentation: () => {},
});
