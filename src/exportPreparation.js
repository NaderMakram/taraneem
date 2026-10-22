const path = require('path');
const { pathToFileURL } = require('url');
const { randomUUID } = require('crypto');
const { BrowserWindow, ipcMain } = require('electron');
const PptxGenJS = require('pptxgenjs');
const { textOptions, cssColorToHex } = require('./presentationText');

const LAYOUTS = Object.freeze({
  '16:9': { width: 13 + 1 / 3, height: 7.5, pixels: [1920, 1080] },
  '3:2': { width: 12, height: 8, pixels: [1920, 1280] },
});

function renderSlide(window, payload) {
  return new Promise((resolve, reject) => {
    const token = randomUUID();
    const cleanup = () => {
      clearTimeout(timer);
      ipcMain.removeListener('pptx:rendered', onRendered);
      window.removeListener('closed', onClosed);
    };
    const onClosed = () => { cleanup(); reject(new Error('Export window closed')); };
    const onRendered = (event, reply) => {
      if (event.sender !== window.webContents || reply?.token !== token) return;
      cleanup();
      reply.error ? reject(new Error(reply.error)) : resolve(reply);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Slide rendering timed out')); }, 30000);
    ipcMain.on('pptx:rendered', onRendered);
    window.once('closed', onClosed);
    window.webContents.send('pptx:render', { ...payload, token });
  });
}

async function exportPreparation({ waiting, aspectRatio, theme, fontSize, bold, filePath, onProgress = () => {} }) {
  const layout = LAYOUTS[aspectRatio];
  if (!layout) throw new Error('Unsupported slide aspect ratio');
  if (!Array.isArray(waiting)) throw new Error('Invalid preparation list');
  const { buildPreparationSlides } = await import(pathToFileURL(path.join(__dirname, 'helpers/songSlides.mjs')).href);
  const slides = buildPreparationSlides(waiting);
  if (!slides.length) throw new Error('لا توجد ترانيم في قائمة التحضير');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PREPARATION', width: layout.width, height: layout.height });
  pptx.layout = 'PREPARATION';
  pptx.author = 'Taraneem';
  pptx.title = 'قائمة التحضير';
  const window = new BrowserWindow({
    show: false, useContentSize: true, width: layout.pixels[0], height: layout.pixels[1],
    webPreferences: { preload: path.join(__dirname, 'songPreload.js'),
      backgroundThrottling: false, offscreen: true, additionalArguments: ['--pptx-export'] },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  try {
    await window.loadFile(path.join(__dirname, 'song.html'));
    let backgroundImage;
    for (let index = 0; index < slides.length; index++) {
      const rendered = await renderSlide(window, { theme, fontSize, bold, html: slides[index].html });
      const slide = pptx.addSlide();
      slide.background = { color: cssColorToHex(rendered.backgroundColor) };
      if (rendered.hasBackgroundImage) {
        if (!backgroundImage) {
          const image = await window.webContents.capturePage();
          if (image.isEmpty()) throw new Error('Could not capture slide background');
          backgroundImage = image.resize({ width: layout.pixels[0], height: layout.pixels[1] }).toDataURL();
        }
        slide.addImage({ data: backgroundImage, x: 0, y: 0, w: layout.width, h: layout.height });
      }
      for (const box of rendered.textBoxes) {
        slide.addText(box.text, textOptions(box, layout));
      }
      onProgress(index + 1, slides.length);
    }
    await pptx.writeFile({ fileName: filePath, compression: true });
    return { slideCount: slides.length };
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

module.exports = { exportPreparation, LAYOUTS };
