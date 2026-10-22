// Shared by the live preview and PowerPoint export so their song order stays identical.
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

export function buildSongSlides(song) {
  const chorus = song.chorus || [];
  const verses = song.verses || [];
  const slides = [];
  const format = (text) => "<div class='verse-line'>" + escapeHtml(text)
    .replace(/\n/g, "</div><div class='verse-line'>")
    .replace(/\d+/g, (number) => `<span class="repeat-number">${number.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[digit])}</span>`) + '</div>';
  if ((chorus.length && song.chorusFirst) || !verses.length) {
    for (const text of chorus) slides.push({ kind: 'chorus', initial: true, html: format(text) });
  }
  verses.forEach((verse, index) => {
    verse.forEach((text, lineIndex) => {
      const number = lineIndex === 0 ? index + 1 : '';
      slides.push({ kind: 'verse', verseNumber: number,
        html: `<span class="verseNumber">${number ? new Intl.NumberFormat('ar-EG').format(number) : ''}</span><div>${format(text)}</div>` });
    });
    chorus.forEach((text, chorusIndex) => slides.push({ kind: 'chorus', verseNumber: index + 1,
      html: `<span class="chorusSymbol">${chorusIndex === 0 ? 'ق' : ''}</span> ${format(text)}` }));
    if (index === song.lastKnownVerse - 1) slides.push({ kind: 'verse', blank: true, lastKnownVerse: true, html: '' });
  });
  slides.push({ kind: 'verse', blank: true, html: '' });
  return slides;
}

export function buildPreparationSlides(waiting) {
  const songs = waiting.filter((item) => typeof item?.custom_ref === 'string' && item.custom_ref.includes('song'));
  const result = [];
  songs.forEach((song, songIndex) => {
    // A single background-only separator between songs; no trailing separator.
    const slides = buildSongSlides(song);
    slides.pop();
    result.push(...slides);
    if (songIndex < songs.length - 1 && !result[result.length - 1]?.blank) {
      result.push({ kind: 'verse', blank: true, html: '' });
    }
  });
  return result;
}
