import { pause } from "./pause.js";
import { isSupportedDigit, normalizeDigits } from "./bibleSearchUtils.mjs";
const input = document.querySelector("input#title-input");
let keySequence = [];
const slideScreen = document.querySelector("#slide-screen");

import { newSlide } from "./newSlide.js";

export function handleKeyDown(e) {
  // ///////////////
  // handle up and down keys
  // ///////////////
  // ignore changing the font size key strokes
  if (e.target.id == "fontSize") {
    return;
  }
  if (document.getElementById("settings-modal").classList.contains("open")) {
    return;
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const previewOutput = document.getElementById("preview_output");
    const activeElement = previewOutput.querySelector(".active");

    if (activeElement) {
      const elements = document.querySelector(".song-preview").children;
      const index = Array.from(activeElement.parentElement.children).indexOf(
        activeElement
      );

      if (
        (index === 0 && e.key === "ArrowUp") ||
        (index === elements.length - 1 && e.key === "ArrowDown")
      ) {
        return; // Do nothing for first and last slide
      }

      const newIndex = e.key === "ArrowUp" ? index - 1 : index + 1;
      const newActiveElement = elements[newIndex];

      activeElement.classList.remove("active");
      newActiveElement.classList.add("active");

      newSlide(newActiveElement.innerHTML);
    }
  }

  // ///////////////
  const key = e.key;
  const focusedElementType = document.activeElement.tagName.toLowerCase();

  // escape focus
  if (key === "Escape") {
    // Get the currently focused element
    const focusedElement = document.activeElement;

    // Remove focus from the currently focused element
    focusedElement.blur();
  }

  // Check if the focused element is an input field or a number field
  if (
    focusedElementType === "input" &&
    (document.activeElement.type === "text" ||
      document.activeElement.type === "number")
  ) {
    return; // Do nothing if the focused element is an input field
  }

  if (key === "End") {
    let AllSlides = document.querySelectorAll(".slide");
    let AllEffectiveSlides = document.querySelectorAll(
      '.verse[data-verse-number]:not([data-verse-number=""])'
    );
    console.log(AllEffectiveSlides);
    if (AllEffectiveSlides.length == 0) {
      AllEffectiveSlides = document.querySelectorAll(
        '.bible-verse[data-verse-number]:not([data-verse-number=""])'
      );
    }

    if (AllSlides) {
      let lastSlide = AllEffectiveSlides[AllEffectiveSlides.length - 1];
      // let elements = document.querySelector(".song-preview").children;

      for (let i = 0; i < AllSlides.length; i++) {
        AllSlides[i].classList.remove("active");
      }

      lastSlide.classList.add("active");
      newSlide(lastSlide.innerHTML);
    }

    return;
  }
  if (key === "Home") {
    let activeSlide = document.querySelector("#preview_output .active");
    if (activeSlide) {
      activeSlide.classList.remove("active");
    }
    let firstSlide = document.querySelector("#preview_output div[data-verse-number='1']");
    firstSlide.classList.add("active");
    newSlide(firstSlide.innerHTML);
    return;
  }

  // Capture Latin, Arabic-Indic, and Eastern Arabic-Indic digits while
  // preserving the exact glyphs the user typed in the on-screen overlay.
  if (isSupportedDigit(key)) {
    keySequence.push(key);
    slideScreen.textContent = keySequence.join("");

    if (keySequence.length === 4) {
      keySequence = [];
      slideScreen.textContent = "";
    }

    e.preventDefault();
    return;
  }

  // Arabic letter quick focus & start typing. These ranges deliberately omit
  // Arabic digits, which are handled by the numeric capture above.
  const arabicRegex = /[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u0750-\u077F\u08A0-\u08FF]/;

  if (
    !e.ctrlKey && // make sure Ctrl is NOT pressed
    e.key.length === 1 && // single character
    arabicRegex.test(e.key) && // Arabic letter
    focusedElementType !== "input" // avoid overriding real typing
  ) {
    e.preventDefault();

    // Focus input and insert Arabic letter
    input.focus();
    input.value = ""; // clear previous search
    input.value = e.key; // insert first typed letter
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
    return;
  }

  if (e.keyCode === 13) {
    // Check if the pressed key is Enter
    // Check if there's content in the slide screen
    let bigElement = document.querySelector(".big");
    if (slideScreen.textContent.trim() == "" && bigElement) {
      let activeSlide = document.querySelector("#preview_output .active");
      console.log(!activeSlide);
      console.log(bigElement.classList.contains("active"));
      if (bigElement.classList.contains("selectedSong") && !activeSlide) {
        console.log("here");
        setTimeout(() => {
          bigElement.click();
        }, 300);
      }
    } else if (slideScreen.textContent.trim() !== "") {
      // Log the content
      const numberPressed = parseInt(
        normalizeDigits(slideScreen.textContent.trim()),
        10
      );
      console.log(numberPressed);

      let element = document.querySelector(
        `[data-verse-number="${numberPressed}"]`
      );
      if (element) {
        const elements = document.querySelector(".song-preview").children;

        for (let i = 0; i < elements.length; i++) {
          elements[i].classList.remove("active");
        }

        element.classList.add("active");
        newSlide(element.innerHTML);
      }

      keySequence = [];
      // Clear the slide screen
      slideScreen.textContent = "";
    }
  } else if (e.ctrlKey && e.code == "KeyF") {
    // console.log(window.scrollY);
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });

    const checkIfScrolledToTop = () => {
      if (window.scrollY === 0) {
        input.focus();
        input.select();
      } else {
        requestAnimationFrame(checkIfScrolledToTop);
      }
    };

    requestAnimationFrame(checkIfScrolledToTop);
  } else if ((e.ctrlKey && e.code === "KeyW") || e.code === "Escape") {
    pause();
  }
}
