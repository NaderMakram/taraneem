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

let dragingContainer = document.querySelector("#waiting_output");

dragingContainer.addEventListener("drag", () => {
  console.log("draggggging");
  // Trigger a reflow to update the transition
  dragingContainer.style.transform = "translateZ(0)";
});

let drake = dragula([dragingContainer], {
  moves: function (el, container, handle) {
    return handle.classList.contains("handle");
  },
});

drake.on("drop", (el, target, source, sibling) => {
  // console.log(sibling);
  // console.log("el.ref", el.dataset.ref);
  // console.log("old waiting", waiting);
  let newIndex = waiting.length - 1;
  // // console.log("el ref", el.dataset.ref);
  let oldIndex = findIndexByKeyValue(waiting, "refIndex", el.dataset.ref);
  // let oldIndex = waiting.map((e) => e.refIndex).indexOf(el.dataset.ref);
  if (oldIndex == -1) oldIndex = waiting.length - 1;
  if (sibling) {
    console.log("sibling.ref", sibling.dataset.ref);
    let siblingIndex = findIndexByKeyValue(
      waiting,
      "refIndex",
      sibling.dataset.ref
    );
    newIndex = oldIndex > siblingIndex ? siblingIndex : siblingIndex - 1;
    console.log("sibling index", siblingIndex);
    // if (oldIndex < newIndex) newIndex -= 1;
  } else {
    console.log(sibling, "no new index");
  }
  console.log("old index", oldIndex);
  console.log("new index", newIndex);

  array_move(waiting, oldIndex, newIndex);
  console.log(waiting);
  // el.querySelector("span").style.cursor = "grab";
});

function array_move(arr, old_index, new_index) {
  if (new_index >= arr.length) {
    return;
  }
  const movedObject = arr.splice(old_index, 1)[0]; // Remove the object at oldIndex and get it
  arr.splice(new_index, 0, movedObject); // Insert the object at newIndex
  displayWaitingList(waiting);
}

function findIndexByKeyValue(arr, key, value) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] == value) {
      return i; // Return the index if the key value matches
    }
  }
  return -1; // Return -1 if the value is not found in the array
}
drake.on("cloned", (clone, original, type) => {
  // el.style.cursor = "grabbing";
  // source.style.cursor = "grabbing";
  console.log("cloned", clone, original, type);
  // source.classList.add("moving");
});
let res;
let searchResults;
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
let delay = 50;

export async function searchAndDisplayResults(term) {
  // if term contains digits meaning it's a bible search
  let containsDigit = /\d/.test(term);

  searchResults = await window.myCustomAPI.searchTerm(term);
  res = searchResults.map(({ item, refIndex }) => {
    // Add a prefix to the bible results to differentiate them from songs with the same index
    let modifiedRefIndex = containsDigit ? `b-${refIndex}` : refIndex;
    // Return the modified object
    return { item, refIndex: modifiedRefIndex };
  });

  console.log(typeof res);
  console.log("containsDigit: ", containsDigit);

  if (containsDigit) {
    // display bible
    search_output.innerHTML = generateBibleHTML(res, term);
  } else {
    // display songs
    search_output.innerHTML = generateHTML(res);
  }
  console.log(res);
}

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
    let foundItem = res.find((song) => song.refIndex == ref);
    if (foundItem && !waiting.some((item) => item.refIndex == ref)) {
      waiting.push({
        item: foundItem.item,
        refIndex: foundItem.refIndex,
      });
      console.log(foundItem.refIndex);
      console.log(clickedChapter);
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
        newSlide(firstSlide.innerHTML);
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
        newSlide("");
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
        newSlide(firstSlide.innerHTML);
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
        newSlide("");
      }
    }
  }
}
