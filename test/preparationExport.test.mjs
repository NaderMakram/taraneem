import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSongSlides, buildPreparationSlides } from '../src/helpers/songSlides.mjs';
const song = { custom_ref: 'song-1', chorusFirst: true, chorus: ['قرار\nمرتين 2'], verses: [['أول', 'تكملة'], ['ثاني']] };

test('keeps live chorus/verse sequence and Arabic verse and repeat numbers', () => {
  const slides = buildSongSlides(song);
  assert.deepEqual(slides.map(s => s.kind), ['chorus', 'verse', 'verse', 'chorus', 'verse', 'chorus', 'verse']);
  assert.match(slides[0].html, /repeat-number">٢/);
  assert.match(slides[1].html, /verseNumber">١/);
  assert.match(slides[3].html, /chorusSymbol">ق/);
  assert.equal(slides.at(-1).blank, true);
});
test('exports only waiting songs, in order, with one separator and no trailing blank', () => {
  const slides = buildPreparationSlides([song, { custom_ref: 'chapter-1' }, { ...song, custom_ref: 'local-song-2', chorus: [], verses: [['النهاية']] }]);
  assert.equal(slides.length, 8);
  assert.equal(slides.filter(s => s.blank).length, 1);
  assert.equal(slides[6].blank, true);
  assert.match(slides[7].html, /النهاية/);
});
test('handles chorus only, verse first, last-known-verse breaks and empty lists', () => {
  assert.deepEqual(buildPreparationSlides([]), []);
  assert.equal(buildSongSlides({ chorus: ['قرار'], verses: [] }).length, 2);
  assert.equal(buildSongSlides({ ...song, chorusFirst: false })[0].kind, 'verse');
  assert.equal(buildSongSlides({ ...song, lastKnownVerse: 1 })[4].blank, true);
});
test('escapes lyrics instead of executing embedded HTML', () => {
  const slides = buildSongSlides({ chorus: ['<img src=x onerror="alert()"> &'], verses: [] });
  assert.ok(!slides[0].html.includes('<img'));
  assert.match(slides[0].html, /&lt;img/);
  assert.match(buildSongSlides({ chorus: ["God's love"], verses: [] })[0].html, /God&apos;s love/);
});

import conversion from '../src/presentationText.js';
test('maps browser coordinates and font aliases to editable RTL PowerPoint text', () => {
  const box = { x: 100, y: 200, width: 800, height: 150, fontSize: 100,
    fontFamily: 'MyCalibri', fontWeight: '400', fontStyle: 'normal',
    color: 'rgb(245, 245, 245)', textShadow: 'rgba(0, 0, 0, 0.8) 3px -4px 5px' };
  const options = conversion.textOptions(box, { width: 12, pixels: [1920, 1280] });
  assert.equal(options.fontFace, 'Calibri');
  assert.equal(options.fontSize, 45);
  assert.equal(options.color, 'F5F5F5');
  assert.equal(options.bold, true); // The bundled Calibri face is bold.
  assert.equal(options.rtlMode, true);
  assert.equal(options.y, 1.25);
  assert.equal(options.wrap, false);
  assert.equal(options.shadow.offset, 2.25);
  assert.equal(options.shadow.opacity, 0.8);
  assert.equal(options.shadow.angle, 306.86989764584405);
  assert.equal(conversion.textOptions({ ...box, fontFamily: 'ibm-plex', textShadow: 'none' }, { width: 12, pixels: [1920, 1280] }).shadow, undefined);
});
