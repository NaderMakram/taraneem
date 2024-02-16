const { ipcRenderer } = require("electron");

ipcRenderer.on("update-font-size", (event, message) => {
  document.querySelector("#content").style.fontSize = `${message / 10}rem`;
});

ipcRenderer.on("toggle-dark-mode", (event, message) => {
  document.body.classList.toggle("dark");
});

ipcRenderer.on("update-font-weight", (event, message) => {
  document.querySelector("#content").classList.toggle("bold");
});

ipcRenderer.on("update-song-window", (event, message) => {
  updateContent(message);
});

function updateContent(content) {
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
