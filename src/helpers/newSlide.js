export function newSlide(html) {
  // console.log(html);
  let paused = document.querySelector(".pause");
  if (paused) paused.classList.remove("pause");
  // if it's a bible verse, add the chapter title

  ///////////////////////  // change the current verse number

  const activeElement = document.querySelector(".active");

  if (activeElement) {
    // Check if .active has a non-empty data-versenumber
    let targetElement = activeElement.getAttribute("data-versenumber")
      ? activeElement
      : activeElement.previousElementSibling?.closest("[data-versenumber]");

    if (targetElement) {
      const verseNumber = targetElement.getAttribute("data-versenumber");

      if (verseNumber) {
        document.querySelector(".current-verse").textContent = verseNumber;
        document.querySelector(".verse-info").classList.add("active-info");
      } else {
        console.log("Found an element, but data-versenumber is empty.");
      }
    } else {
      console.log("No previous element with data-versenumber found.");
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
    console.log(chapter_title);
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
