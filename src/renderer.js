const input = document.querySelector("input#title-input");
const search_output = document.querySelector("#search_output");
const waiting_output = document.querySelector("#waiting_output");
const preview_output = document.querySelector("#preview_output");
const whiteButton = document.querySelector("#white");
const fontSizeInput = document.querySelector("#fontSize");
const fontSizePlus = document.querySelector("#fontSizePlus");
const fontSizeMinus = document.querySelector("#fontSizeMinus");

// buttons
const fontWeightBtn = document.querySelector("#bold");
const extendSongWindowBtn = document.querySelector("#extendSongWindowButton");
const quitAndInstallBtn = document.querySelector("#installBtn");
const prevChapterBtn = document.querySelector("#prevChapter");
const nextChapterBtn = document.querySelector("#nextChapter");
const scrollToTop = document.querySelector('#scroll-top')

const darkModeToggle = document.querySelector("input#dark_mode_input");
const deepModeToggle = document.querySelector("input#deep_mode_input");
const waitingModeToggle = document.querySelector("input#waiting_mode_input");

// import functions
import { handleKeyDown } from "./helpers/handleKeyDown.js";
import { newSlide } from "./helpers/newSlide.js";
import { pause } from "./helpers/pause.js";
// import {
//   previewSelectedChapter,
//   previewSelectedSong,
// } from "./helpers/previewSelectedThing.js";
import { generateBibleHTML, generateHTML } from "./helpers/htmlGenerators.js";
import {
  selectSongEventFunction,
  debounce,
  debouncedSearch,
  searchAndDisplayResults,
} from "./helpers/handleSelectedSong.js";

import { previewSelectedChapter } from "./helpers/previewSelectedSong.js";

document.addEventListener("keydown", () => handleKeyDown(event));

let delay = 50;
whiteButton.addEventListener("click", () => {
  // newSlide("");
  pause();
  whiteButton.blur();
});

darkModeToggle.addEventListener("change", () => {
  window.myCustomAPI.toggleDarkMode();
});

extendSongWindowBtn.addEventListener("click", () => {
  window.myCustomAPI.extendSongWindow();
});

quitAndInstallBtn.addEventListener("click", () => {
  window.myCustomAPI.quitAndInstall();
});

scrollToTop.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  })
})

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
  document.querySelector("#preview_output").innerHTML =
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

deepModeToggle.addEventListener("change", (e) => {
  // console.log(e.target.checked);
  // if (e.target.checked) {
  //   // delay = 350;
  //   debouncedSearch = debounce(searchAndDisplayResults, 350);
  // } else {
  //   // delay = 100;
  //   debouncedSearch = debounce(searchAndDisplayResults, 50);
  // }
  // console.log(delay);
  window.myCustomAPI.flipSearchingMode();
  debouncedSearch(input.value);
});

fontWeightBtn.addEventListener("click", () => {
  window.myCustomAPI.updateFontWeight();
  fontWeightBtn.classList.toggle("bold");
  fontWeightBtn.blur();
});

// fontSizeInput.addEventListener("change", (e) => {
//   window.myCustomAPI.updateFontSize(e.target.value);
//   fontSizeInput.blur();
// });

fontSizePlus.addEventListener("click", () => {
  let currentValue = parseInt(fontSizeInput.textContent);
  console.log(currentValue);
  if (currentValue == 50) return;
  fontSizeInput.textContent = currentValue + 1;
  window.myCustomAPI.updateFontSize(currentValue + 1);
});

fontSizeMinus.addEventListener("click", () => {
  let currentValue = parseInt(fontSizeInput.textContent);
  if (currentValue == 2) return;
  fontSizeInput.textContent = currentValue - 1;
  window.myCustomAPI.updateFontSize(currentValue - 1);
});

waitingModeToggle.addEventListener("change", (e) => {
  // Toggle a class on the body based on checkbox state
  document.body.classList.toggle("waiting-mode", !e.target.checked);
  waitingModeToggle.blur();
});

// let waiting = [];

const button = document.getElementById('start-work');
const worker = new Worker('searchWorker.js');
worker.addEventListener('message', (event) => {
  // resultSpan.textContent = event.data;
  console.log(event.data)
});

// button.addEventListener('click', () => {
//   worker.postMessage('عند شق الفجر باكر'); // Send a message to the worker
// });



// for testing
// setTimeout(() => {
//   input.value = "الرب";
//   let waitingToggle = document.querySelector('#waiting_mode_input')

//   // Create a new event
//   const inputEvent = new Event("input", {
//     bubbles: true,
//     cancelable: true,
//   });
//   waitingToggle.click()

//   input.dispatchEvent(inputEvent);
// }, 1000);

// let clickDev = new Event("click", {
//   bubbles: true,
//   cancelable: true,
// });

// end 1st part of testing

// setTimeout(() => {
//   let son = document.querySelector(".big");
//   son.dispatchEvent(clickDev);
// }, 2500);
// setTimeout(() => {
//   let ver = document.querySelector(".slide");
//   ver.dispatchEvent(clickDev);
// }, 2800);
// end testing

// Attach the debouncedSearch function to the input event
let loader_HTML = `
<div class="content-wrapper">
<div class="placeholder big song">
<div class="animated-background"></div>
</div>
</div>
`

input.addEventListener("input", function (e) {
  let term = e.target.value;
  console.log(term.length)
  if (term.length < 3) return (search_output.innerHTML = "");
  let containsDigit = /\d/.test(term);
  if (!containsDigit && search_output.innerHTML != loader_HTML) {
    search_output.innerHTML = loader_HTML;
  }

  debouncedSearch(term);
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
