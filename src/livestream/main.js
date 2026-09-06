const path = require("path");
const { createSettingsStore, validateSettings } = require("./settingsStore");
const { createLivestreamState } = require("./state");
const { createLivestreamServer } = require("./server");

function createLivestreamManager({ app, BrowserWindow, screen, userDataPath, getMainWindow, getSongWindow, restoreProjectionLayout }) {
  const store = createSettingsStore(userDataPath);
  let settings = store.load();
  const state = createLivestreamState({ ...settings, enabled: false });
  let previewWindow = null;
  let serviceError = null;
  let statusSender = null;
  let quitting = false;
  const service = createLivestreamServer({
    state,
    onClientsChanged: () => publishStatus(),
  });

  function outputUrl(layer = "all", preview = false) {
    if (!service.isRunning()) return "";
    return `http://127.0.0.1:${settings.port}/?layer=${layer}${preview ? "&preview=1" : ""}`;
  }

  function getStatus() {
    const snapshot = state.getSnapshot();
    return {
      mode: snapshot.mode,
      visible: snapshot.visible,
      running: service.isRunning(),
      clientCount: service.getClientCount(),
      url: outputUrl(),
      layerUrls: { all: outputUrl("all"), text: outputUrl("text"), reference: outputUrl("reference") },
      error: serviceError,
      settings,
      revision: snapshot.revision,
    };
  }

  function publishStatus() {
    const main = getMainWindow();
    if (main && !main.isDestroyed()) main.webContents.send("livestream:status", getStatus());
    statusSender?.(getStatus());
  }

  function isTrusted(event) {
    const main = getMainWindow();
    return Boolean(main && !main.isDestroyed() && event?.sender === main.webContents);
  }

  function assertTrusted(event) {
    if (!isTrusted(event)) throw new Error("Unauthorized livestream IPC sender");
  }

  function safePreviewBounds(bounds) {
    if (!bounds) return null;
    const display = screen.getAllDisplays().find(item => {
      const area = item.workArea;
      return bounds.x >= area.x && bounds.x < area.x + area.width - 120 && bounds.y >= area.y && bounds.y < area.y + area.height - 40;
    });
    if (!display) return null;
    const area = display.workArea;
    const width = Math.min(Math.max(480, bounds.width), area.width);
    const height = Math.min(Math.max(270, bounds.height), area.height);
    return { width, height, x: Math.min(Math.max(bounds.x, area.x), area.x + area.width - width), y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - height) };
  }

  function savePreviewBounds() {
    if (!previewWindow || previewWindow.isDestroyed() || previewWindow.isMinimized() || previewWindow.isMaximized()) return;
    try {
      settings = store.save({ ...settings, previewBounds: previewWindow.getBounds() });
    } catch (error) { console.error("Failed to save livestream preview bounds", error); }
  }

  function openPreview() {
    if (!state.getSnapshot().mode || !service.isRunning()) return false;
    if (previewWindow && !previewWindow.isDestroyed()) {
      if (previewWindow.isMinimized()) previewWindow.restore();
      previewWindow.show(); previewWindow.focus(); return true;
    }
    const primary = screen.getPrimaryDisplay().workArea;
    const fallback = { width: Math.min(960, primary.width), height: Math.min(540, primary.height),
      x: primary.x + Math.max(0, Math.floor((primary.width - Math.min(960, primary.width)) / 2)),
      y: primary.y + Math.max(0, Math.floor((primary.height - Math.min(540, primary.height)) / 2)) };
    previewWindow = new BrowserWindow({
      ...(safePreviewBounds(settings.previewBounds) || fallback),
      minWidth: 480,
      minHeight: 270,
      title: "Taraneem · معاينة البث المباشر",
      show: false,
      frame: true,
      movable: true,
      resizable: true,
      minimizable: true,
      transparent: false,
      backgroundColor: "#151b26",
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    previewWindow.on("page-title-updated", event => event.preventDefault());
    previewWindow.loadURL(outputUrl("all", true));
    previewWindow.once("ready-to-show", () => previewWindow?.show());
    previewWindow.on("close", savePreviewBounds);
    previewWindow.on("closed", () => { previewWindow = null; publishStatus(); });
    return true;
  }

  function applyWindowMode(enabled) {
    const main = getMainWindow();
    const song = getSongWindow();
    if (!main || main.isDestroyed()) return;
    if (enabled) {
      if (main.isMaximized()) main.unmaximize();
      main.setResizable(true); main.setMovable(true);
      if (song && !song.isDestroyed()) song.hide();
    } else {
      if (previewWindow && !previewWindow.isDestroyed()) previewWindow.close();
      restoreProjectionLayout();
      if (song && !song.isDestroyed()) song.show();
    }
  }

  async function startService(port) {
    try {
      await service.start(port); serviceError = null; return true;
    } catch (error) {
      serviceError = error?.code === "EADDRINUSE" ? `المنفذ ${port} مستخدم. اختر منفذًا آخر ثم أعد التطبيق.` : "تعذر تشغيل مخرج البث المحلي";
      return false;
    }
  }

  async function initialize() {
    if (settings.enabled) {
      if (await startService(settings.port)) {
        state.setSettings(settings); applyWindowMode(true);
      } else {
        settings = store.save({ ...settings, enabled: false });
      }
    }
    publishStatus();
  }

  async function applySettings(nextSettings) {
    const validated = validateSettings(nextSettings);
    const previous = settings;
    const portChanged = validated.port !== previous.port;
    const needsRestart = validated.enabled && (!service.isRunning() || validated.port !== previous.port);
    if (needsRestart) {
      if (service.isRunning()) await service.stop();
      if (!(await startService(validated.port))) {
        const failedMessage = serviceError;
        if (previous.enabled) await startService(previous.port);
        throw new Error(failedMessage);
      }
    } else if (!validated.enabled && service.isRunning()) {
      await service.stop();
    }
    settings = store.save(validated);
    state.setSettings(settings);
    if (portChanged && previewWindow && !previewWindow.isDestroyed() && settings.enabled) previewWindow.loadURL(outputUrl("all", true));
    applyWindowMode(settings.enabled);
    if (settings.enabled) openPreview();
    publishStatus();
    return getStatus();
  }

  function registerIpc(ipcMain) {
    ipcMain.handle("livestream:get-status", event => { assertTrusted(event); return getStatus(); });
    ipcMain.handle("livestream:apply-settings", (event, value) => { assertTrusted(event); return applySettings(value); });
    ipcMain.handle("livestream:set-visible", (event, visible) => { assertTrusted(event); state.setVisible(visible); publishStatus(); return getStatus(); });
    ipcMain.handle("livestream:open-preview", event => { assertTrusted(event); return openPreview(); });
    ipcMain.on("livestream:publish", (event, payload) => {
      if (!isTrusted(event) || !state.getSnapshot().mode) return;
      try { state.publish(payload); publishStatus(); }
      catch (error) { console.warn("Rejected malformed livestream content", error.message); }
    });
    ipcMain.on("livestream:clear", event => { if (!isTrusted(event)) return; state.clear(); publishStatus(); });
  }

  async function shutdown() {
    if (quitting) return; quitting = true;
    if (previewWindow && !previewWindow.isDestroyed()) previewWindow.destroy();
    await service.stop();
  }

  function handleDisplaysChanged() {
    if (!previewWindow || previewWindow.isDestroyed()) return;
    const bounds = previewWindow.getBounds();
    const safe = safePreviewBounds(bounds);
    if (safe && safe.x === bounds.x && safe.y === bounds.y && safe.width === bounds.width && safe.height === bounds.height) return;
    const area = screen.getPrimaryDisplay().workArea;
    previewWindow.setBounds({ x: area.x + 24, y: area.y + 24, width: Math.min(bounds.width, area.width - 48), height: Math.min(bounds.height, area.height - 48) });
  }

  return { initialize, registerIpc, getStatus, publishStatus, openPreview, shutdown, handleDisplaysChanged,
    isModeEnabled: () => state.getSnapshot().mode,
    clear: () => state.clear(),
    setStatusObserver: callback => { statusSender = callback; },
  };
}

module.exports = { createLivestreamManager };
