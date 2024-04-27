const input = document.querySelector("input#title-input");
const search_output = document.querySelector("#search_output");
const waiting_output = document.querySelector("#waiting_output");
const preview_output = document.querySelector("#preview_output");
const whiteButton = document.querySelector("#white");
const fontSizeInput = document.querySelector("#fontSize");
const fontSizePlus = document.querySelector("#fontSizePlus");
const fontSizeMinus = document.querySelector("#fontSizeMinus");
const fontWeightBtn = document.querySelector("#bold");
const extendSongWindowBtn = document.querySelector("#extendSongWindowButton");
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

extendSongWindowBtn.addEventListener('click', () => {
  window.myCustomAPI.extendSongWindow()
})

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

// for testing
setTimeout(() => {
  input.value = "ماتعولش الهم ومتخافشي";

  // Create a new event
  const inputEvent = new Event("input", {
    bubbles: true,
    cancelable: true,
  });

  input.dispatchEvent(inputEvent);
}, 1000);

// let clickDev = new Event("click", {
//   bubbles: true,
//   cancelable: true,
// });

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
input.addEventListener("input", function (e) {
  let term = e.target.value;
  if (term.length < 3) return (search_output.innerHTML = "");
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
