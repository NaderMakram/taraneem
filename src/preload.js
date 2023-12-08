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
  toggleDarkMode: () => ipcRenderer.send("toggle-dark-mode"),
  readJson: () => ipcRenderer.invoke("read-json"),
});

ipcRenderer.on("shift-slide", (event, message) => {
  console.log("shift the slide", message);
  let element = document.querySelector('[data-verseNumber="1"]');
  const elements = document.querySelector(".song-preview").children;
  for (let i = 0; i < elements.length; i++) {
    elements[i].classList.remove("active");
  }
  
  element.classList.add("active");
  ipcRenderer.send("update-song-window", element.innerHTML);
});
