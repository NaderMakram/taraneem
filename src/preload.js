const { contextBridge, ipcRenderer } = require("electron");
const Sortable = require("sortablejs");

contextBridge.exposeInMainWorld("myCustomAPI", {
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
  toggleDarkMode: () => ipcRenderer.send("toggle-dark-mode"),
  getSiblingChapter: (content) =>
    ipcRenderer.invoke("get-sibling-chapter", content),
  quitAndInstall: () => ipcRenderer.send("quit-and-install"),
  scrollToActive: (Yamount) => ipcRenderer.send("scroll-to-active"),
  readJson: () => ipcRenderer.invoke("read-json"),
  createSortable: (el, options) => Sortable.create(el, options),
});

ipcRenderer.on("log", (event, message) => {
  console.log(message);
});

ipcRenderer.on('search-results', (event, results) => {
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
