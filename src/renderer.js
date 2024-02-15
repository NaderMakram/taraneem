const myBtn = document.querySelector("#btn");
const h1 = document.querySelector("h1");
const input = document.querySelector("input#title-input");
const search_output = document.querySelector("#search_output");
const preview_output = document.querySelector("#preview_output");
const whiteButton = document.querySelector("#white");
const fontSizeInput = document.querySelector("#fontSize");
const fontWeightBtn = document.querySelector("#bold");
const darkModeToggle = document.querySelector("input#dark_mode_input");
const deepModeToggle = document.querySelector("input#deep_mode_input");

let delay = 50;
whiteButton.addEventListener("click", () => {
  // newSlide("");
  pause();
});

darkModeToggle.addEventListener("change", () => {
  window.myCustomAPI.toggleDarkMode();
});

deepModeToggle.addEventListener("change", (e) => {
  console.log(e.target.checked);
  if (e.target.checked) {
    // delay = 350;
    debouncedSearch = debounce(searchAndDisplayResults, 350);
  } else {
    // delay = 100;
    debouncedSearch = debounce(searchAndDisplayResults, 50);
  }
  console.log(delay);
  debouncedSearch(input.value);
  window.myCustomAPI.flipSearchingMode();
});

fontWeightBtn.addEventListener("click", () => {
  window.myCustomAPI.updateFontWeight();
  fontWeightBtn.classList.toggle("bold");
});

fontSizeInput.addEventListener("change", (e) => {
  window.myCustomAPI.updateFontSize(e.target.value);
});

let res;
// input.addEventListener("input", async (e) => {
//   const newTitle = e.target.value;
//   //   window.myCustomAPI.changeTitleTo(newTitle);
//   let res = await window.myCustomAPI.searchTerm(newTitle);
//   console.log(res);
//   search_output.innerHTML = generateHTML(res);
// });

async function searchAndDisplayResults(term) {
  console.log(term.split(/\s+/).reverse().join(" "));
  res = await window.myCustomAPI.searchTerm(term);
  console.log(res);
  // console.log(res);
  // search_output.innerHTML = generateHTML(res);
  search_output.innerHTML = generateBibleHTML(res, term);
}

// Use debounce to delay the search function
let debouncedSearch = debounce(searchAndDisplayResults, delay);

// for testing
setTimeout(() => {
  input.value = "تك21";

  // Create a new event
  const inputEvent = new Event("input", {
    bubbles: true,
    cancelable: true,
  });

  input.dispatchEvent(inputEvent);
}, 500);

let clickDev = new Event("click", {
  bubbles: true,
  cancelable: true,
});

// setTimeout(() => {
//   let son = document.querySelector(".song");
//   son.dispatchEvent(clickDev);
// }, 2000);
// setTimeout(() => {
//   let ver = document.querySelector(".verse");
//   ver.dispatchEvent(clickDev);
// }, 2500);
// end testing

// Attach the debouncedSearch function to the input event
input.addEventListener("input", function (e) {
  let term = e.target.value;
  // if (term.length < 3) return;
  debouncedSearch(term);
});

// input.addEventListener("keydown", function (e) {
//   if (e.key === "Enter") {
//     const term = e.target.value;
//     searchAndDisplayResults(term);
//   }
// });

// input.addEventListener("input", (e) => {
//   //   console.log(e.target.value);
//   search_output.textContent = e.target.value;
// });

search_output.addEventListener("click", (e) => {
  let clickedSong = e.target.closest(".song");

  // if not song then ignore the click
  if (!clickedSong) return;

  // get info about the song
  let ref = clickedSong.getAttribute("data-ref");
  let currentSong = document.querySelector("#preview_output .song-title");
  let currentSongRef = 0;

  // if there is a current song in preview, get it's refIndex
  if (currentSong) {
    currentSongRef = currentSong.getAttribute("data-ref");
  }

  // mark the selected song with red border
  const elements = document.querySelectorAll(".song");

  for (let i = 0; i < elements.length; i++) {
    elements[i].classList.remove("selectedSong");
  }

  // if the selected song already is in preview, start showing the first slide
  clickedSong.classList.add("selectedSong");
  if (ref && currentSongRef && ref == currentSongRef) {
    let firstSlide = document.querySelector(".slide");
    if (firstSlide) {
      newSlide(firstSlide.innerHTML);
      firstSlide.classList.add("active");
    }
    return;

    // if the selected song is not in preview, add it to preview
  } else {
    const targetedSong = res.find((song) => song.refIndex == ref);
    console.log(targetedSong);
    preview_output.innerHTML = previewSelectedChapter(
      targetedSong.item,
      targetedSong.refIndex
    );
    newSlide("");
  }
});

preview_output.addEventListener("click", (e) => {
  let element = e.target.closest(".verse, .chorus");

  if (element) {
    const elements = document.querySelector(".song-preview").children;

    for (let i = 0; i < elements.length; i++) {
      elements[i].classList.remove("active");
    }

    element.classList.add("active");
    newSlide(element.innerHTML);
  }
});

// up and down function
// ////////////////////////
// ////////////////////////
document.addEventListener("keydown", (e) => {
  // ignore changing the font size key strokes
  if (e.target.id == "fontSize") {
    return;
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    // check for first and last slide
    const previewOutput = document.getElementById("preview_output");
    const activeElement = previewOutput.querySelector(".active");
    if (activeElement) {
      const siblings = Array.from(activeElement.parentElement.children);
      const position = siblings.indexOf(activeElement);
      const isLast = position === siblings.length - 1;

      if (
        (isLast && e.keyCode === 40) ||
        (position === 0 && e.keyCode === 38)
      ) {
        return; // Do nothing for first and last slide
      } else {
        // move slide
        const elements = document.querySelector(".song-preview").children;
        let currentActiveIndex = -1;

        for (let i = 0; i < elements.length; i++) {
          if (elements[i].classList.contains("active")) {
            currentActiveIndex = i;
          }
        }

        // Remove the active class outside the loop
        if (currentActiveIndex !== -1) {
          elements[currentActiveIndex].classList.remove("active");
        }

        if (e.keyCode === 38 && currentActiveIndex > 0) {
          // Up arrow
          elements[currentActiveIndex - 1].classList.add("active");
          newSlide(elements[currentActiveIndex - 1].innerHTML);
        } else if (
          e.keyCode === 40 &&
          currentActiveIndex < elements.length - 1
        ) {
          // Down arrow
          elements[currentActiveIndex + 1].classList.add("active");

          newSlide(elements[currentActiveIndex + 1].innerHTML);
        }
      }
    }
  }
});
// ////////////////////////
// ////////////////////////

function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}

function generateHTML(dataArray, truncateLimit = 50) {
  // Ensure the input is an array
  if (!Array.isArray(dataArray)) {
    console.error("Input must be an array.");
    return "";
  }

  // Limit the results to the first 10 elements
  let trimmedResults = dataArray.slice(0, 30);

  // Generate HTML for each element
  let htmlData = trimmedResults
    .map((element) => {
      // Extract information from the object
      let { item, refIndex } = element;
      let { title, chorus, verses } = item;

      // Generate HTML for title
      let titleHTML = title ? `<h2>${title}</h2>` : "";

      // Generate HTML for chorus if it exists
      let chorusHTML = chorus
        ? `<div class="chorus">(ق) ${truncate(
            chorus.map((line) => `${line}`).join(""),
            50
          )}</div>`
        : "";

      // Generate HTML for verses if they exist
      let versesHTML = verses
        ? `<div class="verses">1- ${
            verses[0] && typeof verses[0][0] == "string"
              ? truncate(verses[0][0], truncateLimit)
              : ""
          }</div>`
        : "";

      // Combine everything into a single HTML block
      return `
      <div class="song" data-ref="${refIndex}">
        ${titleHTML}
        ${chorusHTML}
        ${versesHTML}
      </div>
    `;
    })
    .join("");

  return htmlData;
}

function generateBibleHTML(dataArray, term, truncateLimit = 50) {
  // Ensure the input is an array
  if (!Array.isArray(dataArray)) {
    console.error("Input must be an array.");
    return "";
  }

  // Limit the results to the first 10 elements
  let trimmedResults = dataArray.slice(0, 100);

  // Generate HTML for each element
  let htmlData = trimmedResults
    .filter(function (element) {
      let { item } = element;
      let { chapter_number } = item;
      let searched_numbers = term.match(/\d+/g);
      let numbers = searched_numbers ? searched_numbers.map(Number) : 0;
      if (chapter_number != numbers[0]) {
        console.log(searched_numbers);
        return false; // skip
      }
      return true;
    })
    .map((element) => {
      // Extract information from the object
      // console.log(element);
      let { item, refIndex, score } = element;
      let { chapter_name, chapter_number, verses } = item;

      // Generate HTML for title
      let titleHTML = chapter_name ? `<h2>${chapter_name}</h2>` : "";

      // Generate HTML for chorus if it exists
      // let chorusHTML = chorus
      //   ? `<div class="chorus">(ق) ${truncate(
      //       chorus.map((line) => `${line}`).join(""),
      //       50
      //     )}</div>`
      //   : "";

      // Generate HTML for verses if they exist
      // console.log(verses["1"]);
      let versesHTML = verses
        ? `<div class="verses">1- ${
            verses["1"] + "2- " + verses["2"] + " ..."
          }</div>`
        : "";

      // Combine everything into a single HTML block
      return `
      <div class="song" data-ref="${refIndex}" dir="rtl">
        ${titleHTML}
        ${versesHTML}
      </div>
    `;
    })
    .join("");

  return htmlData;
}

// preview selected song
function previewSelectedChapter({ chapter_name, verses }, refIndex) {
  let html = `<h4 class="song-title" data-ref="${refIndex}">${chapter_name}</h4>`;
  html += `<div class="song-preview">`;
  console.log(verses);

  for (const [key, value] of Object.entries(verses)) {
    console.log(`Key: ${key}, Value: ${value}`);
  }

  for (const [key, value] of Object.entries(verses)) {
    console.log(value);

    // add verse number for the first line in a verse
    html += `<div class="verse slide" data-verseNumber="${key}">
          <span class="verseNumber">${key}</span>
          <div>
          ${value}
          </div>
          </div>`;
  }

  html += `</div>`;
  return html;
}

// debounce function
function debounce(func, delay) {
  let timeoutId;

  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// function scroll(y) {
//   window.scrollBy({
//     top: x,
//     left: y,
//     behavior: "smooth",
//   });
// }

function countLineBreaks(text) {
  const lineBreakRegex = /\n/g;
  const matches = text.match(lineBreakRegex);
  return matches ? matches.length : 0;
}

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall >= delay) {
      func(...args);
      lastCall = now;
    }
  };
}

// start testing jsoneditor
// create the editor
// async function readJson() {
//   const container = document.getElementById("jsoneditor");
//   const options = { mode: "view" };

//   const myJson = await window.myCustomAPI.readJson();
//   const editor = new JSONEditor(container, options, myJson);
//   console.log(editor);
//   // editor.set(myJson);

//   const updatedJson = editor.get();
// }
// readJson();

// all ctrl shortcuts
document.addEventListener("keydown", (e) => {
  // console.log(e);
  if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
    // The user pressed Shift + a number (1-9)
    const numberPressed = parseInt(e.key);
    // console.log(numberPressed);

    let element = document.querySelector(
      `[data-verseNumber="${numberPressed}"]`
    );
    // if (!element) return;
    // console.log(element);
    // const elements = document.querySelector(".song-preview").children;
    // for (let i = 0; i < elements.length; i++) {
    //   elements[i].classList.remove("active");
    // }

    // element.classList.add("active");
    // ipcRenderer.send("update-song-window", element.innerHTML);
    if (element) {
      const elements = document.querySelector(".song-preview").children;

      for (let i = 0; i < elements.length; i++) {
        elements[i].classList.remove("active");
      }

      element.classList.add("active");
      newSlide(element.innerHTML);
    }
  }

  if (e.ctrlKey && e.code == "KeyF") {
    // console.log(window.scrollY);
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, window.scrollY / (window.scrollY < 4000 ? 3 : 12));
  }

  if (e.ctrlKey && e.code == "KeyW") {
    // newSlide("");
    pause();
  }
});

function pause() {
  let active = document.querySelector(".active");
  if (!active) return;
  if (active.classList.contains("pause")) {
    active.classList.remove("pause");
    window.myCustomAPI.updateSongWindow(active.innerHTML);
  } else {
    active.classList.add("pause");
    window.myCustomAPI.updateSongWindow("");
  }
}

function newSlide(html) {
  let paused = document.querySelector(".pause");
  if (paused) paused.classList.remove("pause");
  window.myCustomAPI.updateSongWindow(html);
}
