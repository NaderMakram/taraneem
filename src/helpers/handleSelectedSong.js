import { generateHTML, generateBibleHTML } from "./htmlGenerators.js";
import {
  previewSelectedSong,
  previewSelectedChapter,
} from "./previewSelectedSong.js";
import { newSlide } from "./newSlide.js";
import { displayWaitingList } from "./displayWaitingList.js";
const fontSizeInput = document.querySelector("#fontSize");
const fontSizePlus = document.querySelector("#fontSizePlus");
const fontSizeMinus = document.querySelector("#fontSizeMinus");
const siblingChaptersBtns = document.querySelector("#siblingChaptersBtns");
const export_pdf = document.querySelector("#export_pdf");

// const fs = require("fs");

let sortableOptions = {
  handle: ".handle",
  animation: 220,
  ghostClass: "sortable-ghost",
  swapThreshold: 1,
  forceFallback: true,
  scroll: true,
  forceAutoScrollFallback: true,
  scrollSensitivity: 100,
  scrollSpeed: 10,
  bubbleScroll: false,
  onEnd: (e) => {
    array_move(waiting, e.oldIndex, e.newIndex);
  },
};

myCustomAPI.createSortable(
  document.querySelector("#waiting_output"),
  sortableOptions
);

function array_move(arr, old_index, new_index) {
  if (new_index >= arr.length) {
    return;
  }
  const movedObject = arr.splice(old_index, 1)[0]; // Remove the object at oldIndex and get it
  arr.splice(new_index, 0, movedObject); // Insert the object at newIndex
  displayWaitingList(waiting);
}

let res;
let waiting = [];
let storedWaiting = localStorage.getItem("waiting");
// console.log(storedWaiting);
if (storedWaiting && storedWaiting != "undefined") {
  // console.log("local", storedWaiting);
  waiting = JSON.parse(storedWaiting);
  displayWaitingList(waiting);
  // displayWaitingList(waiting)
}
console.log("waiting", waiting);
let delay = 200;

// const songsDB = JSON.parse(
//   fs.readFileSync(path.join(__dirname, "taraneemDB.json"), "utf-8")
// );

// let loader_HTML = `
// <div class="content-wrapper">
// <div class="placeholder big song">
// <div class="animated-background"></div>
// </div>
// </div>
// `

// const worker = new Worker('searchWorker.js');
let currentWorker; // Store a reference to the current worker
let startSearchTime;
export async function searchAndDisplayResults(term) {
  // console.log(search_output.innerHTML == loader_HTML)
  // let containsDigit = /\d/.test(term);
  // if (!containsDigit && search_output.innerHTML != loader_HTML) {
  //   search_output.innerHTML = loader_HTML;
  // }
  console.log("doing a search >>>>>>>", term);

  // Terminate the previous worker if it exists
  if (currentWorker) {
    currentWorker.terminate();
  }

  // Create a new worker instance
  currentWorker = new Worker("searchWorker.js");
  currentWorker.addEventListener("message", (event) => {
    let { term, results, time } = event.data;
    console.log("time to travel from worker: ", Date.now() - time);
    generatHTML(term, results);
  });

  currentWorker.postMessage({
    term,
    songsWithSearchableContent: myCustomAPI.songsWithSearchableContent,
    bibleDBIndexed: myCustomAPI.bibleDBIndexed,
  }); // Send the search term to the worker (corrected typo)
  startSearchTime = Date.now(); // Get start time before worker creation
}

let generatHTML = (term, results) => {
  const searchTime = Date.now() - startSearchTime; // Calculate time
  console.log(`total search time: ${searchTime.toFixed(2)} ms`);

  // console.log('search input', document.querySelector('#title-input').value)
  if (document.querySelector("#title-input").value.length < 3) {
    return (search_output.innerHTML = "");
  }
  let containsDigit = /\d/.test(term);
  res = results.map(({ item, refIndex }) => {
    // Add a prefix to the bible results to differentiate them from songs with the same index
    let modifiedRefIndex = containsDigit ? `b-${refIndex}` : refIndex;
    // Return the modified object
    return { item, refIndex: modifiedRefIndex };
  });

  // console.log(typeof res);
  // console.log("containsDigit: ", containsDigit);

  if (containsDigit) {
    // display bible
    search_output.innerHTML = generateBibleHTML(res, term);
  } else {
    // display songs
    search_output.innerHTML = generateHTML(res);
  }
  // console.log(res);
};

export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Use debounce to delay the search function
export let debouncedSearch = debounce(searchAndDisplayResults, delay);

let toggleFontSizeInput = (isBible) => {
  if (isBible) {
    // show sibling chapter buttons
    siblingChaptersBtns.style.display = "flex";
    // Disable the input field
    fontSizeInput.disabled = true;
    fontSizePlus.disabled = true;
    fontSizeMinus.disabled = true;

    // Change cursor style to not-allowed
    fontSizeInput.style.cursor = "not-allowed";
    fontSizePlus.style.cursor = "not-allowed";
    fontSizeMinus.style.cursor = "not-allowed";

    // Adjust opacity to visually indicate disabled state
    fontSizeInput.style.opacity = "0.3";
    fontSizePlus.style.opacity = "0.3";
    fontSizeMinus.style.opacity = "0.3";

    // remove hover effect from buttons
    fontSizePlus.classList.remove("hover-bg");
    fontSizeMinus.classList.remove("hover-bg");
  } else {
    // hide sibling chapter buttons
    siblingChaptersBtns.style.display = "none";

    // Enable the input field
    fontSizeInput.disabled = false;
    fontSizePlus.disabled = false;
    fontSizeMinus.disabled = false;

    // Reset cursor style
    fontSizeInput.style.cursor = "pointer";
    fontSizePlus.style.cursor = "pointer";
    fontSizeMinus.style.cursor = "pointer";

    // Reset opacity
    fontSizeInput.style.opacity = "1";
    fontSizePlus.style.opacity = "1";
    fontSizeMinus.style.opacity = "1";

    // reset hover effect from buttons
    fontSizePlus.classList.add("hover-bg");
    fontSizeMinus.classList.add("hover-bg");
  }
};

let createAddedFeedback = (container, feedbackClass) => {
  const feedbackIcon = document.createElement("div");
  feedbackIcon.classList.add(feedbackClass);

  // Set feedbackIcon position to match container
  feedbackIcon.style.position = "absolute"; // Make feedbackIcon position relative to container
  feedbackIcon.style.top = "-15px";
  feedbackIcon.style.left = "6px";

  container.appendChild(feedbackIcon);

  // Rest of your code for animation and removal remains the same
  requestAnimationFrame(() => {
    feedbackIcon.style.transform = "translateY(-50px)";
    feedbackIcon.style.opacity = "0";
  });

  setTimeout(() => {
    container.removeChild(feedbackIcon);
  }, 1000);
};

export function selectSongEventFunction(e) {
  if (e.target.classList.contains("handle")) return;
  let clickedSong = e.target.closest(".song");
  let clickedChapter = e.target.closest(".chapter");
  let clickedPlus = e.target.classList.contains("plus");
  let clickedDelete = e.target.classList.contains("delete");
  // console.log("clickedSong: " + clickedSong);
  // console.log("clickedChapter: " + clickedChapter);
  // if not song then ignore the click

  if (clickedDelete) {
    let clickedRef = e.target.parentNode.getAttribute("data-ref");
    console.log(clickedRef);
    waiting = waiting.filter((item) => item.refIndex != clickedRef);

    // remove the deleted song/chapter from the dom
    let deletedDiv = document.querySelector(
      `#waiting_output div[data-ref="${clickedRef}"]`
    );
    if (deletedDiv) {
      deletedDiv.parentNode.removeChild(deletedDiv);
    }
    // displayWaitingList(waiting);
    return;
  }
  if (clickedPlus) {
    let ref;
    if (clickedSong) {
      ref = clickedSong.getAttribute("data-ref");
    } else {
      ref = clickedChapter.getAttribute("data-ref");
    }
    console.log(ref);
    // console.log(res.find((song) => song.refIndex == ref));
    console.log(clickedSong);
    let foundItem = res.find((song) => song.refIndex == ref);
    if (foundItem && !waiting.some((item) => item.refIndex == ref)) {
      waiting.push({
        item: foundItem.item,
        refIndex: foundItem.refIndex,
      });
      createAddedFeedback(
        clickedSong ? clickedSong : clickedChapter,
        "yellowCheck"
      );

      console.log(foundItem.refIndex);
      console.log(clickedChapter);
    } else {
      createAddedFeedback(
        clickedSong ? clickedSong : clickedChapter,
        "rightHand"
      );
    }
    displayWaitingList(waiting);
    return;
  }

  if (clickedSong) {
    toggleFontSizeInput(false);
    // get info about the song
    let ref = clickedSong.getAttribute("data-ref");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = 0;

    // if there is a current song in preview, get it's refIndex
    if (currentSong) {
      currentSongRef = currentSong.getAttribute("data-ref");
    }

    // mark the selected song with red border
    const elements = document.querySelectorAll(".big");

    for (let i = 0; i < elements.length; i++) {
      elements[i].classList.remove("selectedSong");
    }

    // if the selected song already is in preview, start showing the first slide
    if (!clickedPlus) {
      clickedSong.classList.add("selectedSong");
    }
    if (ref && currentSongRef && ref == currentSongRef) {
      let firstSlide = document.querySelector(".slide");
      if (firstSlide) {
        // if there is an active element remove it
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        firstSlide.classList.add("active");
        newSlide(firstSlide.innerHTML, false);
      }
      return;

      // if the selected song is not in preview, add it to preview
    } else {
      let targetedSong;
      if (clickedSong.parentNode.id == "search_output") {
        targetedSong = res.find((song) => song.refIndex == ref);
      } else if (clickedSong.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.refIndex == ref);
      }
      if (!clickedPlus) {
        preview_output.innerHTML = previewSelectedSong(
          targetedSong.item,
          targetedSong.refIndex
        );
        newSlide("", false);
      }
    }
  } else if (clickedChapter) {
    toggleFontSizeInput(true);
    let ref = clickedChapter.getAttribute("data-ref");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = 0;

    // if there is a current song in preview, get it's refIndex
    if (currentSong) {
      currentSongRef = currentSong.getAttribute("data-ref");
    }

    console.log(res);
    // mark the selected song with red border
    const elements = document.querySelectorAll(".big");

    if (!clickedPlus) {
      for (let i = 0; i < elements.length; i++) {
        elements[i].classList.remove("selectedSong");
      }
    }

    // if the selected song already is in preview, start showing the first slide
    clickedChapter.classList.add("selectedSong");
    if (ref && currentSongRef && ref == currentSongRef) {
      let firstSlide = document.querySelector(".slide");
      if (firstSlide) {
        // if there is an active element remove it
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        firstSlide.classList.add("active");
        newSlide(firstSlide.innerHTML, true);
      }
      return;

      // if the selected song is not in preview, add it to preview
    } else {
      let targetedSong;
      if (clickedChapter.parentNode.id == "search_output") {
        targetedSong = res.find((song) => song.refIndex == ref);
      } else if (clickedChapter.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.refIndex == ref);
      }
      if (!clickedPlus) {
        preview_output.innerHTML = previewSelectedChapter(
          targetedSong.item,
          targetedSong.refIndex
        );
        newSlide("", true);
      }
    }
  }
}

export_pdf.addEventListener("click", () => {
  window.myCustomAPI.exportAllSongsToPDF(waiting);
  console.log("clicked btn");
});
