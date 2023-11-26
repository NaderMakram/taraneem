const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("myCustomAPI", {
  changeTitleTo: (title) => ipcRenderer.send("set-title", title),
  searchTerm: (term) => ipcRenderer.invoke("search-songs", term),
  updateSongWindow: (content) => {
    ipcRenderer.send("update-song-window", content);
    // console.log(content.clientHeight);
    // window.scrollBy(0, content.clientHeight);
  },
  updateFontSize: (content) => ipcRenderer.send("update-font-size", content),
  updateFontWeight: () => ipcRenderer.send("update-font-weight"),
});
