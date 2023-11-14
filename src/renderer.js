console.log(window.firstname);
window.ringTheBell();

const myBtn = document.querySelector("#btn");
const h1 = document.querySelector("h1");
const input = document.querySelector("input");
const search_output = document.querySelector("#search_output");
const preview_output = document.querySelector("#preview_output");

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
const debouncedSearch = debounce(searchAndDisplayResults, 300);

setTimeout(() => {
  input.value = "ان رب المجد";

  // Create a new event
  const inputEvent = new Event("input", {
    bubbles: true,
    cancelable: true,
  });

  // Dispatch the event on the input element
  input.dispatchEvent(inputEvent);
}, 500); // Wait for 1000 milliseconds (1 second)

// Attach the debouncedSearch function to the input event
input.addEventListener("input", function (e) {
  const term = e.target.value;
  debouncedSearch(term);
});

input.addEventListener("input", (e) => {
  //   console.log(e.target.value);
  search_output.textContent = e.target.value;
});

search_output.addEventListener("click", (e) => {
  let song = e.target.closest(".song");
  if (!song) return;
  console.log(song);
  let ref = song.getAttribute("data-ref");
  const targetedSong = res.find((song) => song.refIndex == ref);
  // console.log(res[1].refIndex);
  console.log(targetedSong.item);
  preview_output.innerHTML = previewSelectedSong(targetedSong.item);
});

preview_output.addEventListener("click", (e) => {
  let element = e.target;
  if (
    element.classList.contains("verse") ||
    element.classList.contains("chorus")
  ) {
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
  // console.log(e.key);
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
      versesHTML = "";
      // Combine everything into a single HTML block
      return `
        <div class="song" data-ref="${refIndex}">
          ${titleHTML}
          ${chorusHTML ? `<div class="chorus">${chorusHTML}</div>` : ""}
          ${versesHTML ? `<div class="verses">${versesHTML}</div>` : ""}
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

  if (chorusFirst && chorus && chorus.length > 0) {
    html += `<div class="chorus">${replaceLineBreaks(chorus.join("\n"))}</div>`;
  }

  if (verses && verses.length > 0) {
    verses.forEach((verse) => {
      // Display each line in a separate div
      verse.forEach((line) => {
        html += `<div class="verse">${replaceLineBreaks(line)}</div>`;
      });

      if (chorus && chorus.length > 0) {
        html += `<div class="chorus">${replaceLineBreaks(
          chorus.join("\n")
        )}</div>`;
      }
    });
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
