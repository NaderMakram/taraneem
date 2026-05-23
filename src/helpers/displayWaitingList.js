function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}

import { generate_item_html } from "./htmlGenerators.js";

export function displayWaitingList(waiting) {
  // console.log("waiting", waiting);

  // 1. Maintain Selection State
  let currentSelectedSong = document.querySelector("#waiting_output .selectedSong");
  let currentSelectedSongId = currentSelectedSong ? currentSelectedSong.getAttribute("data-id") : null;

  // 2. Persist to LocalStorage
  localStorage.setItem("waiting_list", JSON.stringify(waiting));

  // 3. Generate HTML
  let htmlData = waiting
    .map((item) => {
      // We pass the item, use the matched_phrase (if it exists) for highlighting,
      // set limit to 50, and set isWaitingList = true
      return generate_item_html(item, item.matched_phrase || "", 50, true);
    })
    .join("");

  // 4. Render to DOM
  let waiting_output = document.getElementById("waiting_output"); // Ensure this element exists in scope or import it

  if (htmlData == "") {
    waiting_output.innerHTML = `
        <div id="waiting-placeholder">
          <h4>اضغط على علامة <img src="./img/plus.svg"></h4>
          <h4>لإضافة الترنيمة أو الأصحاح هنا</h4>
        </div>
      `;
  } else {
    waiting_output.innerHTML = htmlData;

    // Restore selection if it still exists
    if (currentSelectedSongId) {
      let newCurrentSelectedSongId = document.querySelector(
        "#waiting_output div[data-id='" + currentSelectedSongId + "']"
      );
      if (newCurrentSelectedSongId) {
        newCurrentSelectedSongId.classList.add("selectedSong");
      }
    }
  }
}