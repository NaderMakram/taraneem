const { ipcRenderer } = require("electron");

ipcRenderer.on("update-font-size", (event, message) => {
  console.log(parseInt(message));
  document.querySelector("body").style.fontSize = `${parseInt(message)}vw`;
});

ipcRenderer.on("set-theme", (event, theme) => {
  // set body attribute
  document.body.setAttribute("data-theme", theme);

  // also keep it in localStorage if you want persistence
  // localStorage.setItem("theme", theme);
});
ipcRenderer.on("set-alignment", (event, alignment) => {
  // set body attribute
  document.body.setAttribute("data-alignment", alignment);
});

ipcRenderer.on("set-vert-alignment", (event, alignment) => {
  // set body attribute
  document.body.setAttribute("data-vert-alignment", alignment);
});

ipcRenderer.on("set-bible-font", (event, font) => {
  document.body.setAttribute("data-bible-font", font);
});

ipcRenderer.on("set-song-font", (event, font) => {
  document.body.setAttribute("data-song-font", font);
});

ipcRenderer.on("update-font-weight", (event, message) => {
  document.querySelector("#content").classList.toggle("bold");
});

// default font sizes for each font
// keys must match the values in index.html > #bible_font_select
const BIBLE_FONT_SIZES = {
  "ibm-plex": 7,
  "traditional-arabic": 8,
  "din-next": 6,
  "adobe-arabic": 9.5,
  "MyCalibri": 7.3,
  "MyTimesNewRoman": 7.3,
};

const DEFAULT_BIBLE_FONT_SIZE = 7.3;

function getBibleMaxFontSize() {
  const currentFont = document.body.getAttribute("data-bible-font");
  if (currentFont && BIBLE_FONT_SIZES[currentFont]) {
    return BIBLE_FONT_SIZES[currentFont];
  }
  return DEFAULT_BIBLE_FONT_SIZE;
}

ipcRenderer.on("update-song-window", (event, content, isBible) => {
  // console.log(isBible);
  if (isBible) {
    // reset html font size
    let text = document.querySelector(".bible-body div");
    if (text) {
      const maxFontSize = getBibleMaxFontSize();
      text.style.fontSize = `${maxFontSize}vw`;
    }
    // update slide
    const contentElement = document.getElementById("content");
    contentElement.innerHTML = content;
    // adjust slide if needed
    adjustFontSizeToFit();
  } else {
    fadeContent(content);
  }
});

function fadeContent(content) {
  const contentElement = document.getElementById("content");

  // Add the fade-out class to initiate the fade-out effect
  contentElement.classList.remove("show");

  // Set a timeout to update the content after the fade-out effect completes
  setTimeout(() => {
    contentElement.innerHTML = content;

    // Add the fade-in class to initiate the fade-in effect
    contentElement.classList.add("show");
  }, 150); // Adjust the duration to match the transition duration
}

// bible font size
function adjustFontSizeToFit() {
  let container = document.querySelector(".bible-body");
  let text = document.querySelector(".bible-body div");
  let html = document.querySelector("html");
  let fontSize = parseFloat(window.getComputedStyle(text).fontSize); // Get the computed font size in vw

  // Reduce font size until text fits within container
  if (fontSize && container && text.scrollHeight > container.offsetHeight) {
    console.time("OptimizedFontSizeCalculation"); // Start measuring time for the optimized font size calculation

    let minFontSize = 4; // Minimum font size
    let maxFontSize = getBibleMaxFontSize(); // Maximum font size (adjust as needed)
    let finalFontSize = -1; // Variable to store the final font size

    // Binary search for the optimal font size
    while (minFontSize <= maxFontSize) {
      const midFontSize = (minFontSize + maxFontSize) / 2; // Calculate the middle font size
      text.style.fontSize = `${midFontSize}vw`; // Set the font size
      // console.log(midFontSize);

      // Check if the text fits within the container
      if (
        text.scrollWidth <= container.offsetWidth &&
        text.scrollHeight <= container.offsetHeight
      ) {
        finalFontSize = midFontSize; // Update the final font size
        minFontSize = midFontSize + 0.1; // Continue searching for larger font size
      } else {
        maxFontSize = midFontSize - 0.1; // Continue searching for smaller font size
      }
    }

    // Apply the final font size
    text.style.fontSize = `${finalFontSize}vw`;

    console.timeEnd("OptimizedFontSizeCalculation"); // End measuring time for the optimized font size calculation and print the result
  }
}
