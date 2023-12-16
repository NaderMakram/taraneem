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
  window.myCustomAPI.updateSongWindow("");
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
  res = await window.myCustomAPI.searchTerm(term);
  // console.log(res);
  search_output.innerHTML = generateHTML(res);
}

// Use debounce to delay the search function
let debouncedSearch = debounce(searchAndDisplayResults, delay);

// for testing
// setTimeout(() => {
//   input.value = "السائح المسيحي";

//   // Create a new event
//   const inputEvent = new Event("input", {
//     bubbles: true,
//     cancelable: true,
//   });

//   input.dispatchEvent(inputEvent);
// }, 500);
// const clickSong = new Event("click", {
//   bubbles: true,
//   cancelable: true,
// });
// setTimeout(() => {
//   let son = document.querySelector(".song");
//   son.dispatchEvent(clickSong);
// }, 2000);
// setTimeout(() => {
//   let ver = document.querySelector(".verse");
//   ver.dispatchEvent(clickSong);
// }, 2500);
// end testing

// Attach the debouncedSearch function to the input event
input.addEventListener("input", function (e) {
  let term = e.target.value;
  if (term.length < 3) return;
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
  if (!clickedSong) return;
  // console.log(song);
  let ref = clickedSong.getAttribute("data-ref");
  const targetedSong = res.find((song) => song.refIndex == ref);
  // console.log(res[1].refIndex);
  console.log(targetedSong.item);
  preview_output.innerHTML = previewSelectedSong(targetedSong.item);
  window.myCustomAPI.updateSongWindow("");
});

preview_output.addEventListener("click", (e) => {
  let element = e.target.closest(".verse, .chorus");

  if (element) {
    const elements = document.querySelector(".song-preview").children;

    for (let i = 0; i < elements.length; i++) {
      elements[i].classList.remove("active");
    }

    element.classList.add("active");
    window.myCustomAPI.updateSongWindow(element.innerHTML);
  }
});

// test up and down function
// ////////////////////////
// ////////////////////////
document.addEventListener("keydown", (e) => {
  // console.log(e.target.id);
  // ignore changing the font size key strokes
  if (e.target.id == "fontSize") {
    return;
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    // check for first and last slide
    const previewOutput = document.getElementById("preview_output");
    const activeElement = previewOutput.querySelector(".active");
    if (activeElement) {
      // console.log("continue");

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
          window.myCustomAPI.updateSongWindow(
            elements[currentActiveIndex - 1].innerHTML
          );
        } else if (
          e.keyCode === 40 &&
          currentActiveIndex < elements.length - 1
        ) {
          // Down arrow
          elements[currentActiveIndex + 1].classList.add("active");
          // let elHeight = elements[currentActiveIndex].clientHeight;
          // let elX = elements[currentActiveIndex].getBoundingClientRect().x;
          // elements[currentActiveIndex].scrollIntoView({ block: "center" });

          window.myCustomAPI.updateSongWindow(
            elements[currentActiveIndex + 1].innerHTML
          );
        } else {
          // Handle other keys or do nothing
          // You can add your custom logic here
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

function generateHTML(dataArray) {
  // Ensure the input is an array
  if (!Array.isArray(dataArray)) {
    console.error("Input must be an array.");
    return "";
  }

  // Take the first 5 elements from the array
  const firstFiveElements = dataArray.slice(0, 15);

  // Generate HTML for each element
  const htmlData = firstFiveElements
    .map((element) => {
      // Extract information from the object
      const { item, refIndex } = element;
      const { title, chorus, verses } = item;

      // Generate HTML for title
      const titleHTML = title ? `<h2>${title}</h2>` : "";

      // Generate HTML for chorus if it exists
      const chorusHTML = chorus
        ? chorus.map((line) => `<p>${line}</p>`).join("")
        : "";

      // Generate HTML for verses if they exist
      let versesHTML = verses
        ? verses
            .map((verse) => {
              const verseLinesHTML = verse
                .map((line) => `<p>${line}</p>`)
                .join("");
              return `<div class="verse">${verseLinesHTML}</div>`;
            })
            .join("")
        : "";
      trimmedVerses = "";
      if (verses[0] && typeof verses[0][0] == "string") {
        trimmedVerses = truncate(verses[0][0], 50);
      }
      versesHTML = "";
      // Combine everything into a single HTML block
      return `
        <div class="song" data-ref="${refIndex}">
          ${titleHTML}
          ${
            chorusHTML
              ? `<div class="chorus">${truncate(chorusHTML, 50)}</div>`
              : ""
          }
          ${verses[0] ? `<div class="verses">${trimmedVerses}</div>` : ""}
        </div>
      `;
    })
    .join("");

  return htmlData;
}

// preview selected song
function previewSelectedSong({ title, chorus, verses, chorusFirst }) {
  let html = `<h4 class="song-title">${title}</h4>`;
  html += `<div class="song-preview">`;
  const replaceLineBreaks = (text) => text.replace(/\n/g, "<br>");

  if ((chorusFirst && chorus && chorus.length > 0) || verses.length == 0) {
    chorus.forEach((line) => {
      html += `<div class="chorus">${replaceLineBreaks(line)}</div>`;
    });
  }

  // if (verses && verses.length > 0) {
  //   verses.forEach((verse) => {
  //     // console.log(verse);
  //     // Display each line in a separate div
  //     verse.forEach((line) => {
  //       html += `<div class="verse">${replaceLineBreaks(line)}</div>`;
  //     });

  //     if (chorus && chorus.length > 0) {
  //       // console.log(chorus);
  //       chorus.forEach((line) => {
  //         html += `<div class="chorus">${replaceLineBreaks(line)}</div>`;
  //       });
  //     }
  //   });
  // }
  if (verses && verses.length > 0) {
    for (let verseIndex = 0; verseIndex < verses.length; verseIndex++) {
      const verse = verses[verseIndex];

      for (let lineIndex = 0; lineIndex < verse.length; lineIndex++) {
        const line = verse[lineIndex];

        // add verse number for the first line in a verse
        let verseNumber = "";
        let arabicNumber = "";
        if (lineIndex == 0) {
          verseNumber = verseIndex + 1;
          arabicNumber = new Intl.NumberFormat("ar-EG").format(verseNumber);
        }
        html += `<div class="verse" data-verseNumber="${verseNumber}">
          <span class="verseNumber">${arabicNumber}</span>
          <div>
          ${replaceLineBreaks(line)}
          </div>
          </div>`;
      }

      if (chorus && chorus.length > 0) {
        for (let chorusIndex = 0; chorusIndex < chorus.length; chorusIndex++) {
          const chorusLine = chorus[chorusIndex];
          let chorusSymbol = "";
          if (chorusIndex == 0) {
            chorusSymbol = "ق";
          }
          html += `<div class="chorus">
          <span class="chorusSymbol">${chorusSymbol}</span>
          ${replaceLineBreaks(chorusLine)}
          </div>`;
        }
      }
    }
  }

  // if (!chorusFirst && chorus && chorus.length > 0) {
  //   html += `<div class="chorus">${replaceLineBreaks(chorus.join("\n"))}</div>`;
  // }
  html += `<div class="chorus"></div>`;

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
  console.log(e);
  if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
    // The user pressed Shift + a number (1-9)
    const numberPressed = parseInt(e.key);
    console.log(numberPressed);

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
      window.myCustomAPI.updateSongWindow(element.innerHTML);
    }
  }

  if (e.ctrlKey && e.code == "KeyF") {
    console.log(window.scrollY);
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
    window.myCustomAPI.updateSongWindow("");
  }
});
