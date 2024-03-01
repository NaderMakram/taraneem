import { pause } from "./pause.js";
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
    let AllSlides = document.querySelectorAll(
      '[data-verseNumber]:not([data-verseNumber=""])'
    );

    if (AllSlides) {
      let lastSlide = AllSlides[AllSlides.length - 1];
      let elements = document.querySelector(".song-preview").children;

      for (let i = 0; i < AllSlides.length; i++) {
        AllSlides[i].classList.remove("active");
      }

      lastSlide.classList.add("active");
      newSlide(lastSlide.innerHTML);
    }

    return;
  }
  if (key === "Home") {
    let AllSlides = document.querySelectorAll(`[data-verseNumber]`);
    if (AllSlides) {
      let firstSlide = AllSlides[0];
      let elements = document.querySelector(".song-preview").children;

      for (let i = 0; i < AllSlides.length; i++) {
        AllSlides[i].classList.remove("active");
      }

      firstSlide.classList.add("active");
      newSlide(firstSlide.innerHTML);
    }

    return;
  }

  // Check if the pressed key is a number
  if (!isNaN(key)) {
    // Add the pressed key to the sequence
    keySequence.push(key);

    // Display the key sequence in the slide screen
    slideScreen.textContent = keySequence.join("");

    // Reset the sequence every 3 digits
    if (keySequence.length === 4) {
      // Reset the sequence
      keySequence = [];
      // Clear the slide screen
      slideScreen.textContent = "";
    }

    // Pre default behavior
    e.preventDefault();
  } else if (e.keyCode === 13) {
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
      console.log(slideScreen.textContent.trim());
      const numberPressed = parseInt(slideScreen.textContent.trim());
      // console.log(numberPressed);

      let element = document.querySelector(
        `[data-verseNumber="${numberPressed}"]`
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
    setTimeout(() => {
      input.focus();
      input.select();
    }, window.scrollY / (window.scrollY < 4000 ? 3 : 15));
  } else if (e.ctrlKey && e.code == "KeyW") {
    pause();
  }
}
