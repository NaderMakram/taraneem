// Exercise the production preview modules in the app's bundled Chromium.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename], { env, stdio: "inherit", windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow } = require("electron");
  const root = path.resolve(__dirname, "..");
  const cache = path.join(root, ".cache", "bible-preview-test");
  fs.mkdirSync(cache, { recursive: true });
  app.setPath("userData", path.join(cache, "user-data"));
  const timeout = setTimeout(() => app.exit(1), 45000);
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { backgroundThrottling: false, offscreen: true } });
    try {
      const source = fs.readFileSync(path.join(root, "src", "index.html"), "utf8")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace("<head>", `<head><base href="${pathToFileURL(path.join(root, "src") + path.sep).href}">`);
      const fixture = path.join(cache, "preview.html");
      fs.writeFileSync(fixture, source);
      await win.loadFile(fixture);
      const raw = JSON.parse(fs.readFileSync(path.join(root, "src", "bible_normalized.json"), "utf8"));
      const chapters = raw.map((chapter, index) => ({
        ...chapter, normalized_verses: undefined,
        siblings: [index > 0 ? index - 1 : null, index + 1 < raw.length ? index + 1 : null],
        custom_ref: `chapter-${index}`,
      }));
      const moduleUrl = pathToFileURL(path.join(root, "test", "bibleChapterPreview.integration.mjs")).href;
      const result = await win.webContents.executeJavaScript(`import(${JSON.stringify(moduleUrl)}).then(m => m.run(${JSON.stringify(chapters)}))`);
      console.log(result);
      const searchModuleUrl = pathToFileURL(path.join(root, "test", "bibleReferenceSearch.integration.mjs")).href;
      console.log(await win.webContents.executeJavaScript(`import(${JSON.stringify(searchModuleUrl)}).then(m => m.run(${JSON.stringify(chapters)}))`));
      const review = path.join(root, ".impeccable", "review");
      fs.mkdirSync(review, { recursive: true });
      for (const [width, name] of [[1280, "desktop"], [1024, "desktop-compact"]]) {
        win.setSize(width, 800);
        await win.webContents.executeJavaScript("window.prepareChapterScreenshot()");
        await new Promise(resolve => setTimeout(resolve, 300));
        const image = await win.webContents.capturePage();
        fs.writeFileSync(path.join(review, `${name}.png`), image.toPNG());
      }
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
}
