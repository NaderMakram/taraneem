const { ipcRenderer } = require("electron");

ipcRenderer.on("update-font-size", (event, message) => {
  console.log(parseInt(message));
  document.querySelector("html").style.fontSize = `${parseInt(message)}px`;
});

ipcRenderer.on("toggle-dark-mode", (event, message) => {
  document.body.classList.toggle("dark");
});

ipcRenderer.on("update-font-weight", (event, message) => {
  document.querySelector("#content").classList.toggle("bold");
});

ipcRenderer.on("change-text-color", (event, color) => {
  document.querySelector(".song-body").style.color = color;
});

ipcRenderer.on("change-bg-image", (event, imageUrl) => {
  console.log(imageUrl);
  document.querySelector(
    ".song-body"
  ).style.backgroundImage = `url('${imageUrl}')`;
});

ipcRenderer.on("update-song-window", (event, content, isBible) => {
  console.log("updating song window");
  console.log(isBible ? "its bible" : "its song");
  // console.log(isBible);
  if (isBible) {
    // reset html font size
    let text = document.querySelector(".bible-body div");
    if (text) {
      text.style.fontSize = `6.9vw`;
    }
    // update slide
    const bibleContent = document.querySelector("#bible-content");
    // hide song html and display bible
    document.querySelector("#song-content").style.display = "none";
    document.querySelector("#song-content").classList.remove("active");
    bibleContent.style.display = "block";
    bibleContent.innerHTML = content;
    // adjust slide if needed
    adjustFontSizeToFit();
  } else {
    // hide bible html and display song
    document.querySelector("#bible-content").style.display = "none";
    document.querySelector("#song-content").style.display = "block";
    document.querySelector("#song-content").classList.add("active");
    fadeContent(content);
  }
});

function fadeContent(content) {
  const contentElement = document.querySelector("#song-content .fade-in-out");

  // Add the fade-out class to initiate the fade-out effect
  contentElement.classList.remove("show");

  // Set a timeout to update the content after the fade-out effect completes
  setTimeout(() => {
    contentElement.innerHTML = content;

    // Add the fade-in class to initiate the fade-in effect
    contentElement.classList.add("show");
  }, 150); // Adjust the duration to match the transition duration
}

function adjustFontSizeToFit() {
  let container = document.querySelector(".bible-body");
  let text = document.querySelector(".bible-body div");
  let html = document.querySelector("html");
  let fontSize = parseFloat(window.getComputedStyle(text).fontSize); // Get the computed font size in vw

  // Reduce font size until text fits within container
  if (fontSize && container && text.scrollHeight > container.offsetHeight) {
    console.time("OptimizedFontSizeCalculation"); // Start measuring time for the optimized font size calculation

    let minFontSize = 4; // Minimum font size
    let maxFontSize = 6.9; // Maximum font size (adjust as needed)
    let finalFontSize = -1; // Variable to store the final font size

    // Binary search for the optimal font size
    while (minFontSize <= maxFontSize) {
      const midFontSize = (minFontSize + maxFontSize) / 2; // Calculate the middle font size
      text.style.fontSize = `${midFontSize}vw`; // Set the font size
      console.log(midFontSize);

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
