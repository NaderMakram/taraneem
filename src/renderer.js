const input = document.querySelector("input#title-input");
const search_output = document.querySelector("#search_output");
const waiting_output = document.querySelector("#waiting_output");
const preview_output = document.querySelector("#preview_output");
const whiteButton = document.querySelector("#white");
const fontSizeInput = document.querySelector("#fontSize");
const fontSizePlus = document.querySelector("#fontSizePlus");
const fontSizeMinus = document.querySelector("#fontSizeMinus");

// buttons
// const extendSongWindowBtn = document.querySelector("#extendSongWindowButton");
const quitAndInstallBtn = document.querySelector("#installBtn");
const prevChapterBtn = document.querySelector("#prevChapter");
const nextChapterBtn = document.querySelector("#nextChapter");
const scrollToTop = document.querySelector("#scroll-top");

const themeSelect = document.getElementById("theme_select");
// const waitingModeToggle = document.querySelector("input#waiting_mode_input");
const alignmentToggle = document.querySelector("button#alignBtn");

// import functions
import { handleKeyDown } from "./helpers/handleKeyDown.js";
import { newSlide } from "./helpers/newSlide.js";
import { pause } from "./helpers/pause.js";

import {
  searchAndDisplayResults,
  initSearchEngine
} from "./helpers/searchService.js";

document.addEventListener("DOMContentLoaded", () => {
  // This pulls the data from Preload ONE TIME and caches it
  initSearchEngine();
});


import {
  selectSongEventFunction,
} from "./helpers/handleSelectedSong.js";


import { previewSelectedChapter } from "./helpers/previewSelectedSong.js";

document.addEventListener("keydown", () => handleKeyDown(event));

whiteButton.addEventListener("click", () => {
  // newSlide("");
  pause();
  whiteButton.blur();
});

themeSelect.addEventListener("change", (e) => {
  const theme = e.target.value; // "light", "dark", "solarized-dark", etc.

  // save choice
  localStorage.setItem("theme", theme);

  // send to main / apply immediately
  window.myCustomAPI.setTheme(theme);
});



quitAndInstallBtn.addEventListener("click", () => {
  window.myCustomAPI.quitAndInstall();
});

scrollToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
});

const previewSiblingChapter = async function (event) {
  let index = parseInt(event.target.dataset.chapterindex);
  let siblingChapter = await window.myCustomAPI.getSiblingChapter(index);
  console.log(siblingChapter);

  // should clear current slide
  window.myCustomAPI.updateSongWindow("");
  // should remove any active slides
  let activeSong = document.querySelector(".selectedSong");
  if (activeSong) {
    activeSong.classList.remove("selectedSong");
  }

  previewSelectedChapter(siblingChapter);
};

prevChapterBtn.addEventListener("click", (event) => {
  previewSiblingChapter(event);
  prevChapterBtn.blur();
});
nextChapterBtn.addEventListener("click", (event) => {
  previewSiblingChapter(event);
  nextChapterBtn.blur();
});




fontSizePlus.addEventListener("click", () => {
  let currentValue = parseInt(fontSizeInput.textContent);
  console.log(currentValue);
  if (currentValue == 20) return;
  fontSizeInput.textContent = currentValue + 1;
  window.myCustomAPI.updateFontSize(currentValue + 1);
});

fontSizeMinus.addEventListener("click", () => {
  let currentValue = parseInt(fontSizeInput.textContent);
  if (currentValue == 2) return;
  fontSizeInput.textContent = currentValue - 1;
  window.myCustomAPI.updateFontSize(currentValue - 1);
});


// Attach the debouncedSearch function to the input event
let loader_HTML = `
<div class="content-wrapper">
<div class="placeholder big song">
<div class="animated-background"></div>
</div>
</div>
`;

input.addEventListener("input", function (e) {
  let term = e.target.value;
  if (term.length < 1) return (search_output.innerHTML = "");
  let containsDigit = /\d/.test(term);
  if (!containsDigit && search_output.innerHTML != loader_HTML) {
    // search_output.innerHTML = '';
    // search_output.innerHTML = loader_HTML;
  }

  searchAndDisplayResults(term);
});

input.addEventListener("keydown", function (event) {
  // Check if the pressed key is 'Enter' (key code 13)
  if (event.keyCode === 13) {
    // Log "Enter" to the console
    console.log("Enter");
    let bigElement = document.querySelector(".big");

    // Check if the bigElement exists
    if (bigElement) {
      // Dispatch a click event to the big element twice
      bigElement.click();
    }

    // Remove focus from the input field
    input.blur(); // This removes focus from the input
    // Stop the event from bubbling up to the document
    event.stopPropagation();
  }
});

search_output.addEventListener("click", selectSongEventFunction);
waiting_output.addEventListener("click", selectSongEventFunction);

preview_output.addEventListener("click", (e) => {
  let element = e.target.closest(".verse, .chorus, .bible-verse");

  if (element) {
    const elements = document.querySelector(".song-preview").children;

    for (let i = 0; i < elements.length; i++) {
      elements[i].classList.remove("active");
    }

    element.classList.add("active");
    newSlide(element.innerHTML);
  }
});

// alignment toggle

// Define the order of states
const states = ["default", "top-2", "top-1", "bottom-2", "bottom-1"];
let currentIndex = 0;

alignmentToggle.addEventListener("click", () => {
  // 1. Calculate next index (loop back to 0 if at end)
  currentIndex = (currentIndex + 1) % states.length;

  // 2. Update the value attribute
  // The CSS will instantly react to this change and animate the SVG
  alignmentToggle.setAttribute("value", states[currentIndex]);

  console.log("Current State:", states[currentIndex]); // For debugging
  window.myCustomAPI.setAlignment(states[currentIndex]);
});
