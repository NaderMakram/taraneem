import { generate_item_html } from "./htmlGenerators.js";
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
let storedWaiting = localStorage.getItem("waiting_list");
// console.log(storedWaiting);
if (storedWaiting && storedWaiting != "undefined") {
  // console.log("local", storedWaiting);
  waiting = JSON.parse(storedWaiting);
  displayWaitingList(waiting);
  // displayWaitingList(waiting)
}
// console.log("waiting", waiting);
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
export async function searchAndDisplayResults(term) {
  console.time("Search Execution Time");

  // Terminate the previous worker if it exists
  if (currentWorker) {
    currentWorker.terminate();
  }

  // Create a new worker instance
  currentWorker = new Worker("searchWorker.js");
  currentWorker.addEventListener("message", (event) => {
    let { term, results } = event.data;
    generateHTML(term, results);
  });

  currentWorker.postMessage({
    term,
    songsWithSearchableContent: myCustomAPI.songsWithSearchableContent,
    bibleDBIndexed: myCustomAPI.bibleDBIndexed,
    bibleVerses: myCustomAPI.bibleVerses,
  });
}

let generateHTML = (term, results) => {
  search_output.innerHTML = ""; // Clear previous results

  if (document.querySelector("#title-input").value.length < 3) {
    return;
  }

  res = results;

  let filtered_results = results;
  let containsDigit = /\d/.test(term);
  if (containsDigit) {
    // filter bible chapters to the correct chapter
    filtered_results = res.filter((item) => {
      // Match chapter and verse
      term = term.trim();
      let match = term.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);

      let searched_chapter;
      if (match) {
        searched_chapter = match[1];
        return searched_chapter == item.chapter_number;
      }
    });
  }

  // console.log("filtered results");
  // console.log(filtered_results);

  for (let i = 0; i < Math.min(20, filtered_results.length); i++) {
    let slide = document.createElement("div");
    slide.innerHTML = generate_item_html(filtered_results[i], term);
    slide.classList.add("slide-item");
    slide.style.opacity = "0"; // Initially hidden
    slide.style.transform = "translateY(20px)"; // Slightly lower position

    search_output.appendChild(slide);

    // Staggered animation
    setTimeout(() => {
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, i * 50); // Delay each slide by 100ms
  }
  if (search_output.innerHTML == "") {
    search_output.innerHTML = "not found";
  }
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
    let clickedId = e.target.parentNode.getAttribute("data-id");
    // console.log(clickedId);
    waiting = waiting.filter((item) => item.wairing_id != clickedId);

    // remove the deleted song/chapter from the dom
    let deletedDiv = document.querySelector(
      `#waiting_output div[data-id="${clickedId}"]`
    );
    if (deletedDiv) {
      deletedDiv.parentNode.removeChild(deletedDiv);
    }

    // update localstorage

    displayWaitingList(waiting);
    return;
  }
  if (clickedPlus) {
    let ref;
    let verse;
    if (clickedSong) {
      ref = clickedSong.getAttribute("data-ref");
    } else {
      ref = clickedChapter.getAttribute("data-ref");
      verse = clickedChapter.getAttribute("data-verse");
    }
    // console.log(ref, verse);
    // console.log(res.find((song) => song.custom_ref == ref));
    // console.log(clickedSong);
    let foundItem = res.find((song) => song.custom_ref == ref);
    // console.log(foundItem);
    // if (foundItem && !waiting.some((item) => item.custom_ref == ref)) {
    waiting.push({
      ...foundItem,
      wairing_id: Math.floor(Math.random() * (99999999 - 99) + 99), // random id to handle removal of items
      ...(verse !== undefined && { verse }), // Add 'verse' only if it's defined
      ...(verse !== undefined && { custom_ref: ref }), // Add 'verse' only if it's defined
    });
    createAddedFeedback(
      clickedSong ? clickedSong : clickedChapter,
      "yellowCheck"
    );

    // console.log(foundItem.custom_ref);
    // console.log(clickedChapter);
    // } else {
    //   createAddedFeedback(
    //     clickedSong ? clickedSong : clickedChapter,
    //     "rightHand"
    //   );
    // }
    displayWaitingList(waiting);
    // console.log(waiting);
    return;
  }

  if (clickedSong) {
    toggleFontSizeInput(false);
    // get info about the song
    let ref = clickedSong.getAttribute("data-ref");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = 0;

    // console.log(`ref: ${ref}`);

    // if there is a current song in preview, get it's custom_ref
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
    // console.log(`ref: ${ref}`);
    // console.log(`currentSongRef: ${currentSongRef}`);
    if (ref && currentSongRef && ref == currentSongRef) {
      // console.log(`song is in preview `);
      let firstSlide = document.querySelector(".slide");
      if (firstSlide) {
        // if there is an active element remove it
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        firstSlide.classList.add("active");
        newSlide(firstSlide.innerHTML);
      }
      return;

      // if the selected song is not in preview, add it to preview
    } else {
      // console.log("not in preview");
      // console.log(clickedSong.parentNode.id);
      let targetedSong = null;
      // console.log(res);
      if (clickedSong.parentNode.parentNode.id == "search_output") {
        targetedSong = res.find((song) => song.custom_ref == ref);
      } else if (clickedSong.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }
      if (!clickedPlus) {
        // console.log(`target song: ${targetedSong}`);
        previewSelectedSong(targetedSong);
        newSlide("");
      }
    }
  } else if (clickedChapter) {
    toggleFontSizeInput(true);
    let ref = clickedChapter.getAttribute("data-ref");
    let verse = clickedChapter.getAttribute("data-verse");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = 0;

    // if there is a current song in preview, get it's custom_ref
    if (currentSong) {
      currentSongRef = currentSong.getAttribute("data-ref");
    }

    // console.log(res);
    // mark the selected song with red border
    const elements = document.querySelectorAll(".big");

    if (!clickedPlus) {
      for (let i = 0; i < elements.length; i++) {
        elements[i].classList.remove("selectedSong");
      }
    }

    // if the selected song already is in preview, start showing the first slide
    // if there is verse attribute in the chapter, go to verse slide
    clickedChapter.classList.add("selectedSong");
    // console.log(`chapter ref: ${ref}`);
    // console.log(`currentSongRef: ${currentSongRef}`);

    if (ref && currentSongRef && ref == currentSongRef) {
      console.log(`new ref: ${ref}`);
      console.log(`current ref: ${currentSongRef}`);
      let targetSlide;
      // console.log(typeof verse);
      targetSlide = document.querySelector(
        `.slide[data-verse-number="${verse ? verse : "1"}"]`
      );
      // console.log(targetSlide);

      if (targetSlide) {
        // if there is an active element remove it
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        targetSlide.classList.add("active");
        newSlide(targetSlide.innerHTML);
      }
      return;

      // if the selected song is not in preview, add it to preview
    } else {
      let targetedSong;
      if (clickedChapter.parentNode.parentNode.id == "search_output") {
        targetedSong = res.find((song) => song.custom_ref == ref);
        // console.log(`in search & targetsong is: ${targetedSong}`);
      } else if (clickedChapter.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
        // console.log(`in waiting & targetsong is: ${targetedSong}`);
      }
      if (!clickedPlus) {
        previewSelectedChapter(targetedSong);
        newSlide("");
      }
    }
  }
}
