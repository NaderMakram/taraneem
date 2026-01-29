export function newSlide(html) {
  // console.log(html);
  let paused = document.querySelector(".pause");
  if (paused) paused.classList.remove("pause");
  // if it's a bible verse, add the chapter title

  ///////////////////////  // change the current verse number

  const activeElement = document.querySelector(".active");

  if (activeElement) {
    // Check if .active has a non-empty data-verse-number
    let targetElement = activeElement.getAttribute("data-verse-number")
      ? activeElement
      : activeElement.previousElementSibling?.closest("[data-verse-number]");

    // Special Case: Initial Chorus acts as Verse 1
    if (
      !targetElement &&
      activeElement.classList.contains("initial-chorus")
    ) {
      document.querySelector(".current-verse").textContent = "1";
      let separator = document.querySelector(".separator");
      if (separator) separator.style.display = "inline";
    }

    else if (targetElement) {
      const verseNumber = targetElement.getAttribute("data-verse-number");

      if (verseNumber) {
        document.querySelector(".current-verse").textContent = verseNumber;
        // Show separator
        let separator = document.querySelector(".separator");
        if (separator) separator.style.display = "inline";
      } else {
        console.log("Found an element, but data-verse-number is empty.");
      }
    } else {
      console.log("No previous element with data-verse-number found.");
    }
  }
  ///////////////////////  //

  if (
    (document.querySelector(".slide").classList.contains("bible-verse") &&
      document.querySelector(".slide.active")) ||
    html.legnth == 0
  ) {
    let chapter_title =
      document.querySelector(".song-title").outerHTML +
      document.querySelector(".chapter-title-en").outerHTML;
    // console.log(chapter_title);
    let combined_html = `<div class="container bible-container">
      <div class="head bible-head">
      ${html.length > 53 ? chapter_title : ""}
      </div>
      
      <div class="body bible-body">
      ${html}
      </div>
      </div>`;
    // console.log(combined_html);
    window.myCustomAPI.updateSongWindow(combined_html, true);
  } else {
    let combined_html = `<div class="container song-container">
      <div class="body song-body">
      ${html}
      </div>
      </div>`;
    window.myCustomAPI.updateSongWindow(combined_html, false);
  }
}
