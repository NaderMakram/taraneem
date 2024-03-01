export function pause() {
  let active = document.querySelector(".active");
  // console.log(active.innerHTML);
  if (!active) return;
  if (active.classList.contains("pause")) {
    active.click();
  } else {
    active.classList.add("pause");
    window.myCustomAPI.updateSongWindow("");
  }
}
