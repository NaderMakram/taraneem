"use strict";

// Mirrors the Arabic substitutions used by src/helpers/searchService.js.
function normalize(value) {
  return String(value || "")
    .replace(/أ|آ|إ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ث/g, "س")
    .replace(/ق/g, "ك")
    .replace(/ه/g, "ة")
    .replace(/ذ|ظ/g, "ز")
    .replace(/ؤ|ئ/g, "ء")
    .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
    .replace(/\n/g, " ");
}

function bonus(text, index, termLength) {
  const before = index > 0 ? text[index - 1] : " ";
  const after = text[index + termLength] || " ";
  const wholeWord = (before === " " || index === 0) && after === " ";
  return Math.max(0, 30 - index) + (wholeWord ? 20 : 0);
}

function buildSearchIndex(songs) {
  return songs.map((song, index) => ({
    index,
    title: song.title,
    normalizedTitle: normalize(song.title),
    chorus: (Array.isArray(song.chorus) ? song.chorus : []).map((raw) => ({ raw, text: normalize(raw) })),
    verses: (Array.isArray(song.verses) ? song.verses : []).map((verse) => verse.map((raw) => ({ raw, text: normalize(raw) }))),
  }));
}

function searchIndexedSongs(indexedSongs, query, limit = 50) {
  const term = normalize(query).trim();
  if (!term) return [];

  const results = [];
  indexedSongs.forEach((song) => {
    const title = song.normalizedTitle;
    const titleAt = title.indexOf(term);
    let score = titleAt < 0 ? 0 : 100 + bonus(title, titleAt, term.length);
    let snippet = "";
    let matchedIn = titleAt < 0 ? "" : "العنوان";

    const chorus = song.chorus;
    let bestChorus = 0;
    for (const slide of chorus) {
      const text = slide.text;
      const at = text.indexOf(term);
      if (at < 0) continue;
      const current = 80 + bonus(text, at, term.length);
      if (current > bestChorus) {
        bestChorus = current;
        if (!snippet) {
          snippet = slide.raw;
          if (!matchedIn) matchedIn = "القرار";
        }
      }
    }
    score += bestChorus;

    const verses = song.verses;
    verses.forEach((verse, verseIndex) => {
      let bestVerse = 0;
      for (const slide of verse) {
        const text = slide.text;
        const at = text.indexOf(term);
        if (at < 0) continue;
        const base = !chorus.length && verseIndex === 0 ? 80 : 50;
        const current = Math.max(0, base - verseIndex * 3) + bonus(text, at, term.length);
        if (current > bestVerse) {
          bestVerse = current;
          if (!snippet) {
            snippet = slide.raw;
            if (!matchedIn) matchedIn = `العدد ${verseIndex + 1}`;
          }
        }
      }
      score += bestVerse;
    });

    if (score > 0) {
      if (!snippet) snippet = chorus[0]?.raw || verses.find((verse) => verse.length)?.[0]?.raw || song.title;
      results.push({
        index: song.index,
        title: song.title,
        snippet: String(snippet).replace(/\s+/g, " ").slice(0, 160),
        matchedIn,
        score,
      });
    }
  });

  return results.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit);
}

function searchSongs(songs, query, limit = 50) {
  return searchIndexedSongs(buildSearchIndex(songs), query, limit);
}

module.exports = { normalize, buildSearchIndex, searchIndexedSongs, searchSongs };
