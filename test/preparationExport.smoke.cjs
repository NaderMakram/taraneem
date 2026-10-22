// Run with: node_modules/.bin/electron test/preparationExport.smoke.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { exportPreparation, LAYOUTS } = require('../src/exportPreparation');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'taraneem-export-'));
  try {
    const waiting = [
      { custom_ref: 'song-1', chorusFirst: true, chorus: ['يا رب أنت سلامي\nيا رب أنت رجائي'], verses: [['في كل يوم معك 2']] },
      { custom_ref: 'local-song-2', chorus: [], verses: [['ترنيمة ثانية']] },
    ];
    const background = path.join(output, 'background.png');
    const { nativeImage } = require('electron');
    fs.writeFileSync(background, nativeImage.createFromBitmap(Buffer.from([71, 49, 21, 255]), { width: 1, height: 1 }).toPNG());
    for (const aspectRatio of Object.keys(LAYOUTS)) {
      const filePath = path.join(output, aspectRatio.replace(':', '-') + '.pptx');
      const theme = aspectRatio === '16:9' ? { kind: 'builtin', id: 'dark' } : {
        kind: 'custom', id: 'custom-smoke', background: { type: 'image', color: '#153147', imageUrl: require('url').pathToFileURL(background).href },
        textColor: '#FFFFFF', accentColor: '#FFCC00', shadow: 'dark',
        fonts: { song: 'MyCalibri' }, alignment: { song: { vertical: 'top' } },
      };
      const result = await exportPreparation({ waiting, aspectRatio, theme, fontSize: 7, bold: true, filePath });
      assert.equal(result.slideCount, 5);
      const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
      const presentation = await zip.file('ppt/presentation.xml').async('string');
      const layout = LAYOUTS[aspectRatio];
      assert.match(presentation, new RegExp(`cx="${Math.round(layout.width * 914400 / 10) * 10}" cy="${Math.round(layout.height * 914400)}"`));
      assert.equal(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 5);
      const media = Object.keys(zip.files).filter(name => /^ppt\/media\/.*\.png$/.test(name));
      assert.equal(media.length, aspectRatio === '16:9' ? 0 : 5);
      const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');
      assert.match(slideXml, /<a:t>يا رب أنت سلامي<\/a:t>/);
      assert.match(slideXml, /rtl="1"/);
      assert.match(slideXml, /typeface="Calibri"/);
      assert.match(slideXml, /<p:sp>/);
      assert.match(slideXml, /<a:cs typeface="Calibri"/);
      const verseXml = await zip.file('ppt/slides/slide2.xml').async('string');
      assert.match(verseXml, /<a:t>١<\/a:t>/);
      assert.match(verseXml, /<a:t>٢<\/a:t>/);
      if (aspectRatio === '3:2') assert.match(slideXml, /<a:outerShdw/);
      const separatorXml = await zip.file('ppt/slides/slide4.xml').async('string');
      assert.ok(!separatorXml.includes('<a:t>'), 'separator must have no text');
      const finalXml = await zip.file('ppt/slides/slide5.xml').async('string');
      assert.match(finalXml, /ترنيمة ثانية/);
      for (let index = 0; index < media.length; index++) {
        const buffer = await zip.file(media[index]).async('nodebuffer');
        const image = nativeImage.createFromBuffer(buffer);
        assert.equal(image.isEmpty(), false);
        assert.deepEqual(image.getSize(), { width: layout.pixels[0], height: layout.pixels[1] });
        fs.writeFileSync(path.join(output, `${aspectRatio.replace(':','-')}-${index}.png`), buffer);
      }
      console.log(`PASS ${aspectRatio}: ${result.slideCount} slides, ${filePath}`);
    }
    // Inspect the actual toolbar at the app's split-window width.
    const ui = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { offscreen: true, partition: 'preparation-export-smoke' } });
    await ui.loadFile(path.join(__dirname, '../src/index.html'));
    const uiResult = await ui.webContents.executeJavaScript(`(async () => {
      document.getElementById('startup-loader').remove();
      let received;
      window.myCustomAPI = {
        onExportProgress: () => {},
        exportPreparation: async (options) => { received = options; return { slideCount: 5 }; },
      };
      const { initializePreparationExport } = await import('./helpers/preparation-export.js');
      initializePreparationExport();
      localStorage.setItem('waiting_list', '[]');
      const button = document.getElementById('export-preparation');
      button.click();
      const emptyMessage = document.getElementById('export-status').textContent;
      localStorage.setItem('waiting_list', ${JSON.stringify(JSON.stringify(waiting))});
      document.getElementById('export-aspect-ratio').value = '3:2';
      button.click();
      await new Promise(resolve => setTimeout(resolve, 20));
      const successMessage = document.getElementById('export-status').textContent;
      const enabled = !button.disabled;
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = button.getBoundingClientRect();
      return { emptyMessage, successMessage, enabled, received, visible: rect.right <= innerWidth && rect.left >= 0 };
    })()`);
    assert.match(uiResult.emptyMessage, /أضف ترنيمة/);
    assert.match(uiResult.successMessage, /5/);
    assert.equal(uiResult.received.aspectRatio, '3:2');
    assert.deepEqual(uiResult.received.waiting, waiting);
    assert.equal(uiResult.enabled, true);
    assert.equal(uiResult.visible, true);
    fs.writeFileSync(path.join(output, 'toolbar.png'), (await ui.webContents.capturePage()).toPNG());
    ui.destroy();
    console.log(`Artifacts: ${output}`);
  } catch (error) { console.error(error); process.exitCode = 1; } finally { app.exit(process.exitCode || 0); }
}).catch(error => { console.error(error); app.exit(1); });
