const { contextBridge, ipcRenderer } = require("electron");

ipcRenderer.on("load-content", (event, content) => {
  // Send the content to the renderer process

  window.postMessage({ type: "load-content", content: content });
});
