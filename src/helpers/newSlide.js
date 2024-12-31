export function newSlide(html, isBible) {
  let paused = document.querySelector(".pause");
  if (paused) paused.classList.remove("pause");
  // if it's a bible verse, add the chapter title
  if (
    (document.querySelector(".slide").classList.contains("bible-verse") &&
      document.querySelector(".slide.active")) ||
    html.legnth == 0
  ) {
    let chapter_title = document.querySelector(".song-title").outerHTML;
    let combined_html = `<div class="container bible-container">
      <div class="head bible-head">
      ${html.length > 53 ? chapter_title : ""}
      </div>
      
      <div class="body bible-body">
      ${html}
      </div>
      </div>`;
    // console.log(combined_html);
    window.myCustomAPI.updateSongWindow(combined_html, !html ? isBible : true);
  } else {
    let combined_html = `<div class="container song-container">
      <div class="body song-body">
      ${html}
      </div>
      </div>`;
    window.myCustomAPI.updateSongWindow(combined_html, !html ? isBible : false);
  }
}
