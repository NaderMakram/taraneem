export function buildPresentationMeta(html) {
  if (!html || html.length === 0) {
    return {
      content_type: "blank",
      content_ref: "blank",
      title: null,
      verse_number: null,
    };
  }

  const preview = document.getElementById("preview_output");
  if (!preview) {
    return {
      content_type: "blank",
      content_ref: "blank",
      title: null,
      verse_number: null,
    };
  }

  const active = preview.querySelector(".active");
  const titleEl = preview.querySelector(".song-title");
  const ref = titleEl?.dataset?.ref || "unknown";
  const titleText =
    titleEl?.querySelector("h4")?.textContent?.trim() ||
    titleEl?.textContent?.trim() ||
    null;

  const isBible =
    active?.classList?.contains("bible-verse") ||
    ref.startsWith("chapter-");

  if (isBible) {
    const verseNum = active?.getAttribute("data-verse-number");
    if (verseNum && verseNum !== "0") {
      return {
        content_type: "bible_verse",
        content_ref: ref,
        title: titleText,
        verse_number: verseNum,
      };
    }
    return {
      content_type: "bible_chapter",
      content_ref: ref,
      title: titleText,
      verse_number: null,
    };
  }

  if (ref.includes("song")) {
    return {
      content_type: "song",
      content_ref: ref,
      title: titleText,
      verse_number: null,
    };
  }

  return {
    content_type: "song",
    content_ref: ref,
    title: titleText,
    verse_number: null,
  };
}

export function trackPresentationFromSlide(html) {
  if (!window.myCustomAPI?.trackPresentation) return;
  window.myCustomAPI.trackPresentation(buildPresentationMeta(html));
}
