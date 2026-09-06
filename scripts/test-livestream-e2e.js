const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename], { env, stdio: "inherit", windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow, ipcMain, screen } = require("electron");
  const { createLivestreamManager } = require("../src/livestream/main");
  const { DEFAULT_SETTINGS } = require("../src/livestream/settingsStore");
  const { createLivestreamState } = require("../src/livestream/state");
  const { createLivestreamServer } = require("../src/livestream/server");
  const root = path.resolve(__dirname, "..");
  const cache = path.join(root, ".cache", "livestream-e2e-test");
  const review = path.join(root, ".impeccable", "review");
  fs.rmSync(cache, { recursive: true, force: true }); fs.mkdirSync(cache, { recursive: true }); fs.mkdirSync(review, { recursive: true });
  app.setPath("userData", path.join(cache, "user-data"));
  const timeout = setTimeout(() => app.exit(1), 90000);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const waitFor = async (read, accept, message, timeoutMs = 7000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { const value = await read(); if (accept(value)) return value; await delay(80); }
    throw new Error(message);
  };
  const freePort = () => new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });

  app.whenReady().then(async () => {
    const port = await freePort();
    let operator;
    let output;
    let attacker;
    let restartService;
    const manager = createLivestreamManager({ app, BrowserWindow, screen, userDataPath: app.getPath("userData"), getMainWindow: () => operator, getSongWindow: () => null, restoreProjectionLayout: () => {} });
    manager.registerIpc(ipcMain);
    try {
      operator = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { preload: path.join(root, "test", "livestream-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, offscreen: true, backgroundThrottling: false } });
      operator.webContents.on("preload-error", (_event, preloadPath, error) => console.error("preload-error", preloadPath, error));
      operator.webContents.on("console-message", (_event, level, message) => { if (level >= 2) console.error("operator-console", message); });
      ipcMain.on("update-song-window", (event, content) => { if (event.sender === operator.webContents && content === "") manager.clear(); });
      await manager.initialize();
      const source = fs.readFileSync(path.join(root, "src", "index.html"), "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace("<head>", `<head><base href="${pathToFileURL(path.join(root, "src") + path.sep).href}">`);
      const fixture = path.join(cache, "operator.html"); fs.writeFileSync(fixture, source); await operator.loadFile(fixture);
      const moduleUrl = pathToFileURL(path.join(root, "test", "livestreamOperator.integration.mjs")).href;
      const run = expression => operator.webContents.executeJavaScript(`import(${JSON.stringify(moduleUrl)}).then(m=>${expression})`);
      await run("m.setup()");
      attacker = new BrowserWindow({ show: false, webPreferences: { preload: path.join(root, "test", "livestream-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, offscreen: true } });
      await attacker.loadFile(fixture);
      const untrustedRejected = await attacker.webContents.executeJavaScript("window.myCustomAPI.livestream.getStatus().then(() => false, () => true)");
      assert(untrustedRejected, "Untrusted BrowserWindow could invoke livestream IPC");
      attacker.destroy(); attacker = null;
      let status = await run(`m.setMode(true, ${port})`);
      assert(status.mode && status.running && status.url.includes(`:${port}/`), "Production controller did not enable the manager/service");
      output = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } });
      await output.loadURL(status.url + "&preview=1");
      assert(await output.webContents.executeJavaScript("document.querySelector('#text').textContent === ''"), "Mode enable must start blank");

      const chapters = JSON.parse(fs.readFileSync(path.join(root, "src", "bible_normalized.json"), "utf8"));
      const chapterIndex = chapters.findIndex(chapter => chapter.chapter_book_short === "اس" && Number(chapter.chapter_number) === 8);
      const chapter = { ...chapters[chapterIndex], siblings: [chapterIndex - 1, chapterIndex + 1], custom_ref: `chapter-${chapterIndex}` };
      const prepared = await run(`m.previewBible(${JSON.stringify(chapter)})`);
      assert(prepared.partCount > 1, "Full Esther 8:9 was not measured into multiple parts");
      assert(prepared.reconstructed === chapter.verses["9"].replace(/\s/gu, ""), "Measured parts did not reconstruct full Esther 8:9");
      assert(prepared.sourceIds.length === 1, "Verse parts lost common source identity");

      for (let part = 1; part <= prepared.partCount; part += 1) {
        const active = await run(`m.clickBiblePart(9, ${part})`);
        const rendered = await waitFor(() => output.webContents.executeJavaScript(`(()=>{const text=document.querySelector('#text');const box=document.querySelector('#text-box');const style=getComputedStyle(box);return {text:text.textContent,ref:document.querySelector('#reference').textContent,h:text.scrollHeight<=box.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)+1,w:text.scrollWidth<=text.clientWidth+1}})()`), value => value.text === active.text, "OBS output did not receive the selected measured part");
        assert(rendered.ref === "أستير ٨:٩" && rendered.h && rendered.w, `Esther 8:9 part ${part} overflowed or lost its reference`);
      }

      const fontFamilies = { times: "TaraneemTimes", traditional: "TaraneemTraditional", plex: "TaraneemPlex", din: "TaraneemDin", adobe: "TaraneemAdobe" };
      for (const [font, outputFamily] of Object.entries(fontFamilies)) {
        await run(`m.setFont(${JSON.stringify(font)})`);
        const fontPart = await run("m.clickBiblePart(9, 1)");
        const measured = await run(`m.measurement(${JSON.stringify(fontPart.text)}, "bible")`);
        const renderedFont = await waitFor(() => output.webContents.executeJavaScript(`(async()=>{await document.fonts.ready;const text=document.querySelector('#text');const scene=document.querySelector('#scene');const style=getComputedStyle(text);const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;return {family:getComputedStyle(scene).fontFamily,width:ctx.measureText(text.textContent).width,text:text.textContent}})()`), value => value.text === fontPart.text, `Font ${font} did not render`);
        assert(renderedFont.family.includes(outputFamily), `Output did not select ${font}`);
        assert(Math.abs(renderedFont.width - measured.width) < 1.5, `Measured and rendered ${font} widths diverged`);
      }
      const preset720 = await run("m.applyPreset('720')");
      assert(preset720.status.settings.canvas.width === 1280 && preset720.status.settings.canvas.height === 720, "720p UI preset did not apply");
      assert(preset720.status.settings.appearance.padding === 19 && !preset720.message.includes("لا يكفي"), "720p UI preset failed geometry validation");
      const preset1080 = await run("m.applyPreset('1080')");
      assert(preset1080.status.settings.canvas.width === 1920 && preset1080.status.settings.appearance.padding === 28, "1080p UI preset did not restore scaled layout");
      assert(await run("m.applyReferenceAlignment('center')") === "center", "Reference alignment control did not apply independently");
      assert(await run("m.applyReferenceAlignment('right')") === "right", "Reference alignment control did not restore right alignment");

      const narrowReferenceError = await run("m.setReferenceBox('inline', 80)");
      assert(narrowReferenceError?.includes("أعرض من مساحة الشاهد"), "Narrow inline reference did not raise a visible fit error");
      await run("m.setReferenceBox('above', 1728)");
      await run(`m.previewBible(${JSON.stringify(chapter)})`);

      let active = await run("m.clickBiblePart(9, 1)");
      const next = await run("m.arrow('ArrowDown')");
      assert(next.sourceId === active.sourceId && next.partIndex === 2, "ArrowDown did not advance one measured chunk");
      active = await run("m.numericJump('10')");
      assert(active.parentNumber === "10" && active.partIndex === 1, "Numeric verse jump did not choose the first part");

      await run("m.setVisible(false)");
      const hiddenSelection = await run("m.clickBiblePart(11, 1)");
      const hidden = await waitFor(() => output.webContents.executeJavaScript(`({hidden:document.body.dataset.hidden,text:document.querySelector('#text').textContent})`), value => value.text === hiddenSelection.text, "Hidden selection did not update prepared output");
      assert(hidden.hidden === "true", "Selecting content cleared the manual hidden state");
      await run("m.setVisible(true)");
      await waitFor(() => output.webContents.executeJavaScript("document.body.dataset.hidden"), value => value === "false", "Show output did not restore hidden content");

      assert(await run("m.clearViaChapterNavigation()"), "Chapter navigation fixture could not continue");
      await waitFor(() => output.webContents.executeJavaScript(`document.querySelector('#text').textContent+document.querySelector('#reference').textContent`), value => value === "", "Direct chapter navigation clear left stale OBS content");

      const song = { title: "اختبار المصدر المتكرر", chorus: ["قرار طويل يحتاج إلى تقسيم واضح في مساحة البث المباشر"], verses: [["السطر الأول للعدد الأول"], ["السطر الأول للعدد الثاني"]], chorusFirst: true, custom_ref: "integration-song", lastKnownVerse: 2 };
      const chorusIds = await run(`m.previewSong(${JSON.stringify(song)})`);
      const repeatedId = chorusIds.find(id => id.includes("chorus:after:2"));
      assert(repeatedId && new Set(chorusIds).size >= 3, "Repeated choruses did not retain occurrence identity");
      active = await run(`m.selectSource(${JSON.stringify(repeatedId)}, 1)`);
      const reflowed = await run("m.reflowSong(1)");
      assert(reflowed?.sourceId === repeatedId, "Settings reflow jumped to another repeated chorus occurrence");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === reflowed.text, "Reflowed selected chunk did not reach output");

      let preview = BrowserWindow.getAllWindows().find(win => win !== operator && win !== output);
      assert(preview, "Movable livestream preview did not open");
      preview.minimize();
      const afterMinimize = await run(`m.selectSource(${JSON.stringify(repeatedId)}, ${Math.min(2, reflowed.partCount)})`);
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === afterMinimize.text, "Minimized preview stopped broadcast updates");
      preview.close(); await delay(200);
      const afterClose = await run("m.numericJump('1')");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === afterClose.text, "Closed preview stopped broadcast updates");
      await operator.webContents.executeJavaScript("window.myCustomAPI.livestream.openPreview()"); await delay(300);
      preview = BrowserWindow.getAllWindows().find(win => win !== operator && win !== output);
      assert(preview && !preview.isDestroyed(), "Preview did not reopen from the latest snapshot");

      await run("m.configureNarrowText()");
      const safeSong = { title: "آمن", chorus: ["نور"], verses: [], chorusFirst: true, custom_ref: "safe-before-error", lastKnownVerse: 0 };
      const safeIds = await run(`m.previewSong(${JSON.stringify(safeSong)})`);
      const safePart = await run("m.selectSource(\"song:safe-before-error:chorus:initial:line:0\", 1)");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === safePart.text, "Safe content did not publish before failure test");
      const impossible = await run("m.previewImpossibleSong()");
      assert(impossible.error && impossible.parts === 0, "Impossible song selection did not fail atomically with a visible error");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent + document.querySelector('#reference').textContent"), value => value === "", "Impossible song selection left stale broadcast content");
      await run(`m.previewSong(${JSON.stringify(safeSong)})`);
      const safeBibleBaseline = await run("m.selectSource(\"song:safe-before-error:chorus:initial:line:0\", 1)");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === safeBibleBaseline.text, "Safe content did not republish before Bible failure test");
      const impossibleBible = await run("m.previewImpossibleBible()");
      assert(impossibleBible.error && impossibleBible.parts === 0 && impossibleBible.usable, "Impossible Bible chapter did not fail atomically while keeping a visible, operable preview");
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent + document.querySelector('#reference').textContent"), value => value === "", "Impossible Bible chapter left stale broadcast content");

      await run("m.setMode(false)");
      await delay(3300);
      assert(await output.webContents.executeJavaScript("document.querySelector('#text').textContent === '' && document.querySelector('#reference').textContent === ''"), "Connection loss did not blank output after timeout");
      status = await run(`m.setMode(true, ${port})`);
      assert(status.mode && status.running, "Service did not restart on re-enable");
      await waitFor(() => output.webContents.executeJavaScript("document.body.dataset.hidden"), value => value === "false", "Browser source did not reconnect after service restart");
      assert(await output.webContents.executeJavaScript("document.querySelector('#text').textContent === ''"), "Re-enabled mode did not remain blank");

      const settings = await run("m.getLivestreamStatus ? m.getLivestreamStatus() : window.myCustomAPI.livestream.getStatus()");
      await operator.webContents.executeJavaScript(`(()=>{document.querySelectorAll('[data-page]').forEach(p=>p.hidden=p.dataset.page!=='livestream');const modal=document.querySelector('#settings-modal');modal.classList.add('open');modal.dataset.currentPage='livestream';window.dispatchEvent(new CustomEvent('livestream-page-shown'));})()`);
      operator.setSize(1280, 800); await delay(200);
      const desktopLayout = await operator.webContents.executeJavaScript(`(()=>{const body=document.querySelector('.settings-body');const page=document.querySelector('.livestream-settings');return {initialized:document.querySelector('#livestream-enabled').checked&&document.querySelector('#livestream-reference-align').value==='right'&&document.querySelector('#livestream-sample-text').textContent.length>0&&document.querySelector('#livestream-canvas-width').value==='1920'&&document.querySelector('#livestream-url').value.startsWith('http://127.0.0.1:'),bodyFits:body.scrollWidth<=body.clientWidth,pageFits:page.scrollWidth<=page.clientWidth}})()`);
      assert(desktopLayout.initialized, "Settings screenshot did not contain initialized values and source URL");
      assert(desktopLayout.bodyFits && desktopLayout.pageFits, "Desktop livestream settings overflow horizontally");
      fs.writeFileSync(path.join(review, "livestream-settings-desktop.png"), (await operator.webContents.capturePage()).toPNG());
      await operator.webContents.executeJavaScript("document.querySelector('#livestream-song-lines').scrollIntoView({block:'start'})"); operator.setSize(1024, 720); await delay(200);
      const compactFits = await operator.webContents.executeJavaScript(`(()=>{const body=document.querySelector('.settings-body');const page=document.querySelector('.livestream-settings');return body.scrollWidth<=body.clientWidth&&page.scrollWidth<=page.clientWidth})()`);
      assert(compactFits, "Compact livestream settings overflow horizontally");
      fs.writeFileSync(path.join(review, "livestream-settings-compact.png"), (await operator.webContents.capturePage()).toPNG());
      await operator.webContents.executeJavaScript("document.querySelector('#livestream-reference-show').scrollIntoView({block:'start'})"); await delay(150); fs.writeFileSync(path.join(review, "livestream-settings-reference.png"), (await operator.webContents.capturePage()).toPNG());

      await run("m.setMode(false)"); await delay(150); await manager.shutdown();
      const restartedState = createLivestreamState({ ...DEFAULT_SETTINGS, enabled: true });
      restartedState.publish({ content: { id: "epoch", kind: "song", sourceId: "restart", parentType: "verse", parentNumber: "1", partIndex: 1, partCount: 1, lines: ["عاد الاتصال بنجاح"] } });
      restartService = createLivestreamServer({ state: restartedState }); await restartService.start(port);
      await waitFor(() => output.webContents.executeJavaScript("document.querySelector('#text').textContent"), value => value === "عاد الاتصال بنجاح", "New server epoch was rejected after restart", 9000);
      console.log(`Livestream E2E: full Esther ${prepared.partCount} parts; click/arrow/numeric, hide/show, chapter clear, reflow identity, preview lifecycle, reconnect and new epoch passed`);
      operator.destroy(); output.destroy(); await restartService.stop(); clearTimeout(timeout); app.exit(0);
    } catch (error) {
      console.error(error); try { attacker?.destroy(); operator?.destroy(); output?.destroy(); await restartService?.stop(); await manager.shutdown(); } catch (_error) {} clearTimeout(timeout); app.exit(1); process.exit(1);
    }
  });
}
