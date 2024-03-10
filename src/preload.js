const { contextBridge, ipcRenderer } = require("electron");

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
  toggleDarkMode: () => ipcRenderer.send("toggle-dark-mode"),
  scrollToActive: (Yamount) => ipcRenderer.send("scroll-to-active"),
  readJson: () => ipcRenderer.invoke("read-json"),
  updateVersionMessage: (content) => ipcRenderer.send("update-version-message"),
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
