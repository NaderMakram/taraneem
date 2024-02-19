const { ipcRenderer } = require("electron");

ipcRenderer.on("update-font-size", (event, message) => {
  document.querySelector("html").style.fontSize = `${message}px`;
});

ipcRenderer.on("toggle-dark-mode", (event, message) => {
  document.body.classList.toggle("dark");
});

ipcRenderer.on("update-font-weight", (event, message) => {
  document.querySelector("#content").classList.toggle("bold");
});

ipcRenderer.on("update-song-window", (event, content, isBible) => {
  // console.log(isBible);
  if (isBible) {
    // reset html font size
    let html = document.querySelector("html");
    html.style.fontSize = `20px`;
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

function adjustFontSizeToFit() {
  let container = document.querySelector(".bible-body");
  let text = document.querySelector(".bible-body div");
  let html = document.querySelector("html");
  let fontSize = parseInt(window.getComputedStyle(html).fontSize); // Get the computed font size

  // Reduce font size until text fits within container
  if (fontSize && container) {
    while (
      text.scrollWidth > container.offsetWidth ||
      text.scrollHeight > container.offsetHeight
    ) {
      fontSize--;
      html.style.fontSize = `${fontSize}px`;
    }
  }
}
