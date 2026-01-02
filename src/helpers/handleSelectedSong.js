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
    songsWithSearchableContent: myCustomAPI.getSongs(),
    bibleDBIndexed: myCustomAPI.bibleDBIndexed,
    bibleVerses: myCustomAPI.bibleVerses,
  });
}

let generateHTML = (term, results) => {
  // FIX 1: Update the global variable so the click handler works
  window.res = results; 
  
  search_output.innerHTML = ""; 

  let inputVal = document.querySelector("#title-input").value;
  if (inputVal.length < 3) {
    return;
  }

  let filtered_results = results;
  let containsDigit = /\d/.test(term);
  
  if (containsDigit) {
    filtered_results = results.filter((item) => {
      if (item.chapter_number) {
        let cleanTerm = term.trim();
        let match = cleanTerm.match(/(\d+)(?:\s*[:\s]\s*(\d+))?$/);
        if (match) {
          let searched_chapter = match[1];
          return searched_chapter == item.chapter_number;
        }
      }
      return false; 
    });
  }

  const maxResults = Math.min(20, filtered_results.length);

  for (let i = 0; i < maxResults; i++) {
    let slide_content = generate_item_html(filtered_results[i], term);
    
    if (slide_content) {
      let slide = document.createElement("div");
      slide.innerHTML = slide_content;
      slide.classList.add("slide-item");
      slide.style.opacity = "0"; 
      slide.style.transform = "translateY(20px)"; 
      

      // OPTIONAL: Attach the specific object to the DOM element directly
      // This is safer than relying on global 'res' index
      slide.songData = filtered_results[i]; 

      search_output.appendChild(slide);

      setTimeout(() => {
        slide.style.opacity = "1";
        slide.style.transform = "translateY(0)";
      }, i * 50); 
    }
  }

  if (search_output.innerHTML == "") {
    search_output.innerHTML = `
      <div class="note big bold">
        <img src="./img/warning.png" class="warning"/>
        لو بتدور على شاهد كتابي<br>جرب تكتب بالاختصارات
      </div>
    `;
  }
};

// Helper: Smart Fuzzy Highlight for Arabic
function highlightMatch(text, term) {
  if (!text || !term) return text;
  
  // 1. Build a "Fuzzy" Regex Pattern
  // This maps common variations so "alf" matches "alf with hamza", etc.
  let safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  let fuzzyPattern = safeTerm.split('').map(char => {
    // Match any form of Alef
    if (/[اأإآ]/.test(char)) return '[اأإآ]';
    // Match Ya or Alif Maqsura
    if (/[يى]/.test(char)) return '[يى]';
    // Match Ha or Taa Marbuta
    if (/[هة]/.test(char)) return '[هة]';
    // Allow for existing Regex chars or English text
    return char; 
  }).join('[\\u064B-\\u065F]*'); // Allow optional Arabic diacritics (Tashkeel) between chars

  try {
    // Create regex: Global, Case-insensitive
    const regex = new RegExp(`(${fuzzyPattern})`, 'gi');
    return text.replace(regex, '<span class="text-highlight" style="background-color: #f1c40f; color: #000; border-radius: 3px;">$1</span>');
  } catch (e) {
    console.error("Regex error", e);
    return text;
  }
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

  // --- DELETE LOGIC (Unchanged) ---
  if (clickedDelete) {
    let clickedId = e.target.parentNode.getAttribute("data-id");
    waiting = waiting.filter((item) => item.wairing_id != clickedId);
    let deletedDiv = document.querySelector(`#waiting_output div[data-id="${clickedId}"]`);
    if (deletedDiv) deletedDiv.parentNode.removeChild(deletedDiv);
    displayWaitingList(waiting);
    return;
  }

  // --- ADD TO WAITING LIST (Unchanged) ---
  if (clickedPlus) {
    let ref;
    let verse;
    if (clickedSong) {
      ref = clickedSong.getAttribute("data-ref");
    } else {
      ref = clickedChapter.getAttribute("data-ref");
      verse = clickedChapter.getAttribute("data-verse");
    }
    let foundItem = window.res.find((song) => song.custom_ref == ref);
    waiting.push({
      ...foundItem,
      wairing_id: Math.floor(Math.random() * (99999999 - 99) + 99),
      ...(verse !== undefined && { verse }),
      ...(verse !== undefined && { custom_ref: ref }),
    });
    createAddedFeedback(clickedSong ? clickedSong : clickedChapter, "yellowCheck");
    displayWaitingList(waiting);
    return;
  }

  // --- SONG SELECTION LOGIC ---
  if (clickedSong) {
    toggleFontSizeInput(false);
    
    let ref = clickedSong.getAttribute("data-ref");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = currentSong ? currentSong.getAttribute("data-ref") : 0;

    // Remove red border from all
    const elements = document.querySelectorAll(".big");
    elements.forEach(el => el.classList.remove("selectedSong"));

    if (!clickedPlus) {
      clickedSong.classList.add("selectedSong");
    }

    // == CHECK IF SONG IS ALREADY IN PREVIEW ==
    if (ref && currentSongRef && ref == currentSongRef) {
      
      // -- SECOND CLICK: GO LIVE -- 
      
      let targetedSong = null;
      if (clickedSong.parentNode.parentNode.id == "search_output") {
        targetedSong = window.res.find((song) => song.custom_ref == ref);
      } else if (clickedSong.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }

      // 1. Get the search term
      let inputVal = document.querySelector("#title-input").value;
      let term = normalize(inputVal).trim(); // Normalize the search term

      // 2. Determine which slide to activate
      let targetSlide = document.querySelector(".slide"); // Default to first slide
      let allSlides = document.querySelectorAll("#preview_output .slide");
      
      if (targetedSong && targetedSong.jumpLocation && term.length > 0) {
        
        let jumpLoc = targetedSong.jumpLocation;

        for (let i = 0; i < allSlides.length; i++) {
          let slide = allSlides[i];
          let slideText = normalize(slide.innerText); // Normalize slide text

          // LOGIC:
          // If the jump location is NOT title (meaning it's in verse or chorus),
          // and this is the very first slide (which is usually the Title Slide),
          // skip it! We don't want to match the title if the user is looking for lyrics.
          if (jumpLoc.section !== 'title' && i === 0) {
             // Assuming first slide is always title. 
             // If your title matches the lyric word (e.g. "Grace"), we skip it 
             // to find "Grace" in the lyrics slide.
             continue; 
          }

          if (slideText.includes(term)) {
            targetSlide = slide;
            break; // Stop at the first valid match
          }
        }
      }

      // 3. Activate and Go Live
      if (targetSlide) {
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        targetSlide.classList.add("active");
        newSlide(targetSlide.innerHTML);
      }
      return;

    } else {
      
      // -- FIRST CLICK: LOAD PREVIEW ONLY --
      
      let targetedSong = null;
      if (clickedSong.parentNode.parentNode.id == "search_output") {
        targetedSong = window.res.find((song) => song.custom_ref == ref);
      } else if (clickedSong.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }
      
      if (!clickedPlus) {
        previewSelectedSong(targetedSong);
        newSlide(""); 
      }
    }
  } 
  
  // --- BIBLE LOGIC (Unchanged) ---
  else if (clickedChapter) {
     // ... (Your existing Bible logic here) ...
    toggleFontSizeInput(true);
    let ref = clickedChapter.getAttribute("data-ref");
    let verse = clickedChapter.getAttribute("data-verse");
    let currentSong = document.querySelector("#preview_output .song-title");
    let currentSongRef = currentSong ? currentSong.getAttribute("data-ref") : 0;

    const elements = document.querySelectorAll(".big");
    if (!clickedPlus) {
      elements.forEach(el => el.classList.remove("selectedSong"));
    }
    clickedChapter.classList.add("selectedSong");

    if (ref && currentSongRef && ref == currentSongRef) {
      let targetSlide = document.querySelector(
        `.slide[data-verse-number="${verse ? verse : "1"}"]`
      );
      if (targetSlide) {
        if (document.querySelector(".active")) {
          document.querySelector(".active").classList.remove("active");
        }
        targetSlide.classList.add("active");
        newSlide(targetSlide.innerHTML);
      }
      return;
    } else {
      let targetedSong;
      if (clickedChapter.parentNode.parentNode.id == "search_output") {
        targetedSong = window.res.find((song) => song.custom_ref == ref);
      } else if (clickedChapter.parentNode.id == "waiting_output") {
        targetedSong = waiting.find((song) => song.custom_ref == ref);
      }
      if (!clickedPlus) {
        previewSelectedChapter(targetedSong);
        newSlide("");
      }
    }
  }
}

// Add this helper if it's not already imported
function normalize(text) {
  if (!text) return "";
  return (
    text
      .replace(/أ|آ|إ/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ث/g, "س")
      .replace(/ق/g, "ك")
      .replace(/ه/g, "ة")
      .replace(/ذ|ظ/g, "ز")
      .replace(/ؤ|ئ/g, "ء")
      .replace(/[ًٌٍَُِّْ~ـٰ]/g, "")
      .replace(/\n/g, " ")
  );
}