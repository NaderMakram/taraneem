const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename], { env, stdio: "inherit", windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow } = require("electron");
  const { DEFAULT_SETTINGS, scalePreset } = require("../src/livestream/settingsStore");
  const { createLivestreamState } = require("../src/livestream/state");
  const { createLivestreamServer } = require("../src/livestream/server");
  const root = path.resolve(__dirname, "..");
  const cache = path.join(root, ".cache", "livestream-browser-test");
  const review = path.join(root, ".impeccable", "review");
  fs.mkdirSync(cache, { recursive: true }); fs.mkdirSync(review, { recursive: true });
  app.setPath("userData", path.join(cache, "user-data"));
  const timeout = setTimeout(() => app.exit(1), 45000);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };

  app.whenReady().then(async () => {
    const state = createLivestreamState({ ...DEFAULT_SETTINGS, enabled: true });
    const service = createLivestreamServer({ state });
    const address = await service.start(0);
    const output = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } });
    const operator = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { offscreen: true, backgroundThrottling: false } });
    try {
      await output.loadURL(`http://127.0.0.1:${address.port}/?layer=all&preview=1`);
      state.publish({ content: { id: "esther", kind: "bible", sourceId: "chapter-427:verse:9", parentType: "verse", parentNumber: "9", partIndex: 2, partCount: 5, lines: ["وَكَتَبَ بِاسْمِ الْمَلِكِ أَحَشْوِيرُوشَ وَخَتَمَ بِخَاتَمِ الْمَلِكِ"] }, reference: "سفر أستير ٨:٩" });
      await delay(350);
      let result = await output.webContents.executeJavaScript(`(async()=>{await document.fonts.ready; const t=document.querySelector('#text'); const b=document.querySelector('#text-box'); const r=document.querySelector('#reference'); return {text:t.textContent,reference:r.textContent,textFits:t.scrollWidth<=t.clientWidth&&t.scrollHeight<=b.clientHeight,referenceFits:r.scrollWidth<=r.clientWidth&&r.scrollHeight<=r.clientHeight,background:getComputedStyle(document.body).backgroundColor};})()`);
      assert(result.text.includes("أَحَشْوِيرُوشَ"), "Arabic diacritics did not render");
      assert(result.reference === "سفر أستير ٨:٩", "Reference did not update atomically");
      assert(result.textFits && result.referenceFits, "1080p text or reference overflowed");
      fs.writeFileSync(path.join(review, "livestream-output-1080.png"), (await output.webContents.capturePage()).toPNG());

      state.setVisible(false); await delay(100);
      assert(await output.webContents.executeJavaScript("document.body.dataset.hidden === 'true' && document.querySelector('#text').textContent.length > 0"), "Hide should retain prepared content while clearing the video surface");
      state.clear(); await delay(100);
      assert(await output.webContents.executeJavaScript("document.querySelector('#text').textContent === '' && document.querySelector('#reference').textContent === ''"), "Clear left body or reference behind");

      const compact = { ...scalePreset(1280, 720), enabled: true };
      state.setSettings(compact);
      state.setVisible(true);
      state.publish({ content: { id: "song", kind: "song", sourceId: "song:sample", parentType: "verse", parentNumber: "1", partIndex: 1, partCount: 2, lines: ["مبارك اسم الرب في كل زمان", "من الآن وإلى الأبد"] }, reference: "ترنيمة مبارك اسم الرب" });
      output.setSize(1280, 720); await delay(300);
      result = await output.webContents.executeJavaScript(`(()=>{const t=document.querySelector('#text');const b=document.querySelector('#text-box');const r=document.querySelector('#reference');return {lines:t.textContent.split('\\n').length,textFits:t.scrollWidth<=t.clientWidth&&t.scrollHeight<=b.clientHeight,referenceFits:r.scrollWidth<=r.clientWidth&&r.scrollHeight<=r.clientHeight}})()`);
      assert(result.lines === 2 && result.textFits && result.referenceFits, "720p two-line layout overflowed");
      fs.writeFileSync(path.join(review, "livestream-output-720.png"), (await output.webContents.capturePage()).toPNG());
      output.setSize(640, 360); await delay(150);
      assert(await output.webContents.executeJavaScript("document.querySelector('#text').textContent.includes('مبارك') && document.querySelector('#scene').style.transform.includes('0.5')"), "Preview resize changed content or failed to scale the logical canvas");

      const source = fs.readFileSync(path.join(root, "src", "index.html"), "utf8")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace("<head>", `<head><base href="${pathToFileURL(path.join(root, "src") + path.sep).href}">`);
      const fixture = path.join(cache, "operator.html"); fs.writeFileSync(fixture, source);
      await operator.loadFile(fixture);
      await operator.webContents.executeJavaScript(`(()=>{document.querySelectorAll('[data-page]').forEach(p=>p.hidden=p.dataset.page!=='livestream');const m=document.querySelector('#settings-modal');m.classList.add('open');m.dataset.currentPage='livestream';document.querySelector('#livestream-url').value='http://127.0.0.1:17841/?layer=all';document.querySelector('#livestream-service-status').textContent='يعمل محليًا · ١ مصدر متصل';document.querySelector('#livestream-service-status').dataset.state='running';})()`);
      for (const [width, height, name] of [[1280, 800, "livestream-settings-desktop"], [1024, 720, "livestream-settings-compact"]]) {
        operator.setSize(width, height); await delay(180);
        fs.writeFileSync(path.join(review, `${name}.png`), (await operator.webContents.capturePage()).toPNG());
      }
      console.log("Livestream browser integration: 1080p/720p fit, atomic reference, hide/clear, resize scaling, and operator screenshots passed");
      output.destroy(); operator.destroy();
      await service.stop(); clearTimeout(timeout); app.exit(0);
    } catch (error) {
      console.error(error); output.destroy(); operator.destroy(); await service.stop(); clearTimeout(timeout); app.exit(1);
    }
  });
}
