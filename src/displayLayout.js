function getDisplayLayout(displays, primary) {
  const singleMonitor = displays.length === 1;
  const { x, y, width, height } = primary.workArea;
  const mainWidth = singleMonitor ? Math.floor(width * 2 / 3) : width;
  const external = displays.find(display => display.id !== primary.id);
  return {
    singleMonitor,
    mainBounds: { x, y, width: mainWidth, height },
    songBounds: singleMonitor
      ? { x: x + mainWidth, y, width: width - mainWidth, height }
      : { ...external.bounds },
  };
}

function leaveFullScreen(window) {
  if (!window.isFullScreen()) return Promise.resolve();
  // On macOS setFullScreen is asynchronous; bounds must be applied afterwards.
  return new Promise(resolve => {
    const done = () => {
      window.removeListener('leave-full-screen', done);
      window.removeListener('closed', done);
      resolve();
    };
    window.once('leave-full-screen', done);
    window.once('closed', done);
    window.setFullScreen(false);
  });
}

function createDisplayManager({ getDisplays, getPrimaryDisplay, getWindows, onChange }) {
  let revision = 0;
  return async () => {
    const currentRevision = ++revision;
    const layout = getDisplayLayout(getDisplays(), getPrimaryDisplay());
    onChange(layout.singleMonitor);
    const { mainWindow, songWindow } = getWindows();
    if (!mainWindow || !songWindow || mainWindow.isDestroyed() || songWindow.isDestroyed()) return;
    await Promise.all([leaveFullScreen(mainWindow), leaveFullScreen(songWindow)]);
    if (currentRevision !== revision || mainWindow.isDestroyed() || songWindow.isDestroyed()) return;
    for (const window of [mainWindow, songWindow]) {
      window.setResizable(true);
      window.setMovable(true);
      window.setMinimizable(true);
      window.setMaximizable(true);
      if (window.isMaximized()) window.unmaximize();
    }
    mainWindow.setBounds(layout.mainBounds);
    songWindow.setBounds(layout.songBounds);
    if (!layout.singleMonitor) {
      mainWindow.maximize();
      songWindow.setFullScreen(true);
    }
    mainWindow.focus();
  };
}

module.exports = { getDisplayLayout, createDisplayManager };
