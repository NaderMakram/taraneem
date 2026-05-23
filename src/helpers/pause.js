import { buildPresentationMeta } from "./presentationMeta.js";

export function pause() {
  let active = document.querySelector(".active");
  // console.log(active.innerHTML);
  if (!active) return;
  if (active.classList.contains("pause")) {
    active.click();
  } else {
    active.classList.add("pause");
    if (window.myCustomAPI?.trackPresentation) {
      window.myCustomAPI.trackPresentation(buildPresentationMeta(""));
    }
    window.myCustomAPI.updateSongWindow("");
  }
}
