const { contextBridge, ipcRenderer } = require("electron");
// window.myAPI = { name: "nader" };

contextBridge.exposeInMainWorld("firstname", "nader");

contextBridge.exposeInMainWorld("ringTheBell", () => console.log("ding ding"));

contextBridge.exposeInMainWorld("myCustomAPI", {
  changeTitleTo: (title) => ipcRenderer.send("set-title", title),
  searchTerm: (term) => ipcRenderer.invoke("search-songs", term),
  updateSongWindow: (content) =>
    ipcRenderer.send("update-song-window", content),
  updateFont: (content) => ipcRenderer.send("update-font-size", content),
});

contextBridge.exposeInMainWorld("modTitleto", (title) =>
  ipcRenderer.send("set-title", title)
);

ipcRenderer.on("load-content", (event, content) => {
  // Handle the 'load-content' event
  // ...
  console.log("new");
});
