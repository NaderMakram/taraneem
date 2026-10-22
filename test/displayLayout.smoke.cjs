// Run with: npm run test:displays
const { app, BrowserWindow, screen } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { createDisplayManager } = require('../src/displayLayout');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  try {
    const primary = screen.getPrimaryDisplay();
    const options = { show: false, frame: true, resizable: true, movable: true, minimizable: true, maximizable: true };
    const mainWindow = new BrowserWindow({ ...options, width: 960, height: 800, webPreferences: { offscreen: true, partition: 'monitor-notice-smoke' } });
    const songWindow = new BrowserWindow({ ...options, width: 400, height: 800 });
    await Promise.all([
      mainWindow.loadFile(path.join(__dirname, '../src/index.html')),
      songWindow.loadFile(path.join(__dirname, '../src/song.html')),
    ]);
    const manage = createDisplayManager({ getDisplays: () => [primary], getPrimaryDisplay: () => primary,
      getWindows: () => ({ mainWindow, songWindow }), onChange: () => {} });
    await manage();
    for (const window of [mainWindow, songWindow]) {
      assert.ok(window.isResizable() && window.isMovable() && window.isMinimizable() && window.isMaximizable());
      const bounds = window.getBounds();
      window.setBounds({ ...bounds, width: bounds.width + 40, x: bounds.x + 10 });
      assert.equal(window.getBounds().width, bounds.width + 40);
      assert.equal(window.getBounds().x, bounds.x + 10);
    }
    mainWindow.setContentSize(960, 800);
    const state = await mainWindow.webContents.executeJavaScript(`(async () => {
      document.getElementById('startup-loader').remove();
      const { initializeMonitorNotice } = await import('./helpers/monitor-notice.mjs');
      await initializeMonitorNotice({
        getDisplayState: async () => ({ singleMonitor: true }),
        onDisplayState: callback => { window.testDisplayState = singleMonitor => callback({ singleMonitor }); },
      });
      const notice = document.getElementById('single-monitor-notice');
      const initial = !notice.hidden;
      document.getElementById('dismiss-monitor-notice').click();
      const dismissed = notice.hidden;
      window.testDisplayState(true);
      const stillDismissed = notice.hidden;
      window.testDisplayState(false);
      const external = notice.hidden;
      window.testDisplayState(true);
      const returned = !notice.hidden;
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bounds = notice.getBoundingClientRect();
      const style = getComputedStyle(notice.querySelector('.toast-message'));
      return { initial, dismissed, stillDismissed, external, returned,
        withinWindow: bounds.left >= 0 && bounds.right <= innerWidth,
        color: style.color, text: notice.textContent, shortcutLabel: notice.querySelector('.windows-logo').getAttribute('aria-label') };
    })()`);
    assert.ok(state.initial && state.dismissed && state.stillDismissed && state.external && state.returned && state.withinWindow);
    assert.equal(state.color, 'rgb(25, 25, 25)');
    assert.match(state.text, /للعرض على شاشة خارجية اضغط/);
    assert.match(state.text, /\+ P/);
    assert.match(state.text, /Extend/);
    assert.ok(!state.text.includes('توسيع'));
    assert.equal(state.shortcutLabel, 'Windows');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'taraneem-monitor-'));
    fs.writeFileSync(path.join(output, 'notice-960.png'), (await mainWindow.webContents.capturePage()).toPNG());
    mainWindow.setContentSize(600, 800);
    await mainWindow.webContents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const fits = await mainWindow.webContents.executeJavaScript(`(() => { const rect = document.getElementById('single-monitor-notice').getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; })()`);
    assert.ok(fits);
    fs.writeFileSync(path.join(output, 'notice-600.png'), (await mainWindow.webContents.capturePage()).toPNG());
    mainWindow.destroy();
    songWindow.destroy();
    console.log(`PASS: native window controls, movement, resizing, and notice states. Screenshots: ${output}`);
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
