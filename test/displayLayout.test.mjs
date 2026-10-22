import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import displayLayout from '../src/displayLayout.js';
import { initializeMonitorNotice } from '../src/helpers/monitor-notice.mjs';
const primary = { id: 2, workArea: { x: 100, y: 30, width: 1500, height: 900 }, bounds: { x: 100, y: 0, width: 1500, height: 930 } };
const external = { id: 1, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } };
class Window extends EventEmitter {
  fullScreen = false;
  maximized = false;
  isDestroyed() { return false; }
  isFullScreen() { return this.fullScreen; }
  isMaximized() { return this.maximized; }
  setFullScreen(value) {
    if (!value && this.fullScreen) setImmediate(() => { this.fullScreen = false; this.emit('leave-full-screen'); });
    else this.fullScreen = value;
  }
  setResizable(value) { this.resizable = value; }
  setMovable(value) { this.movable = value; }
  setMinimizable(value) { this.minimizable = value; }
  setMaximizable(value) { this.maximizable = value; }
  unmaximize() { this.maximized = false; }
  maximize() { this.maximized = true; }
  setBounds(value) { assert.equal(this.fullScreen, false); this.bounds = value; }
  focus() {}
}

test('uses the primary work area for the initial 2:1 split and selects the actual external monitor', () => {
  const layout = displayLayout.getDisplayLayout([primary], primary);
  assert.deepEqual(layout.mainBounds, { x: 100, y: 30, width: 1000, height: 900 });
  assert.deepEqual(layout.songBounds, { x: 1100, y: 30, width: 500, height: 900 });
  assert.deepEqual(displayLayout.getDisplayLayout([external, primary], primary).songBounds, external.bounds);
});

test('returns from fullscreen to movable, resizable, minimizable split windows on disconnection', async () => {
  const mainWindow = new Window();
  const songWindow = new Window();
  let displays = [primary, external];
  const states = [];
  const manage = displayLayout.createDisplayManager({ getDisplays: () => displays, getPrimaryDisplay: () => primary,
    getWindows: () => ({ mainWindow, songWindow }), onChange: state => states.push(state) });
  await manage();
  assert.equal(songWindow.fullScreen, true);
  assert.equal(mainWindow.maximized, true);
  displays = [primary];
  await manage();
  assert.equal(songWindow.fullScreen, false);
  assert.equal(mainWindow.maximized, false);
  for (const window of [mainWindow, songWindow]) {
    assert.ok(window.resizable && window.movable && window.minimizable && window.maximizable);
  }
  assert.deepEqual(songWindow.bounds, { x: 1100, y: 30, width: 500, height: 900 });
  assert.deepEqual(states, [false, true]);
});

test('an older async layout cannot overwrite a newer monitor configuration', async () => {
  const mainWindow = new Window();
  const songWindow = new Window();
  songWindow.fullScreen = true;
  let displays = [primary];
  const manage = displayLayout.createDisplayManager({ getDisplays: () => displays, getPrimaryDisplay: () => primary,
    getWindows: () => ({ mainWindow, songWindow }), onChange: () => {} });
  const first = manage();
  displays = [primary, external];
  const second = manage();
  await Promise.all([first, second]);
  assert.deepEqual(songWindow.bounds, external.bounds);
  assert.equal(songWindow.fullScreen, true);
});

function noticeFixture() {
  const classes = new Set();
  const notice = { hidden: true, classList: {
    toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    remove: name => classes.delete(name),
  } };
  let dismiss, update;
  const close = { addEventListener: (_event, fn) => { dismiss = fn; } };
  const root = { getElementById: id => id === 'single-monitor-notice' ? notice : close };
  const api = { onDisplayState: fn => { update = fn; }, getDisplayState: async () => ({ singleMonitor: true }) };
  return { notice, root, api, dismiss: () => dismiss(), update: state => update({ singleMonitor: state }) };
}

test('notice is dismissible, disappears on connection, and returns on disconnection', async () => {
  const fixture = noticeFixture();
  await initializeMonitorNotice(fixture.api, fixture.root);
  assert.equal(fixture.notice.hidden, false);
  fixture.dismiss();
  fixture.update(true);
  assert.equal(fixture.notice.hidden, true);
  fixture.update(false);
  assert.equal(fixture.notice.hidden, true);
  fixture.update(true);
  assert.equal(fixture.notice.hidden, false);
});

test('a stale initial read cannot show the notice after an external monitor connects', async () => {
  const fixture = noticeFixture();
  let resolve;
  fixture.api.getDisplayState = () => new Promise(done => { resolve = done; });
  const initialization = initializeMonitorNotice(fixture.api, fixture.root);
  fixture.update(false);
  resolve({ singleMonitor: true });
  await initialization;
  assert.equal(fixture.notice.hidden, true);
});
