"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("songEditor", {
  status: () => ipcRenderer.invoke("editor:status"),
  search: (query) => ipcRenderer.invoke("editor:search", query),
  getSong: (index) => ipcRenderer.invoke("editor:get-song", index),
  save: (payload) => ipcRenderer.invoke("editor:save", payload),
});
