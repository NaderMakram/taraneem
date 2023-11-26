// const { ipcRenderer } = require("electron");
// window.addEventListener("message", (event) => {
//   console.log("event");
//   // Check the message type
//   if (event.data && event.data.type === "load-content") {
//     const content = event.data.content;
//     updateContent(content);
//   }
// });

// function updateContent(content) {
//   const contentElement = document.getElementById("content");

//   // Add the fade-out class to initiate the fade-out effect
//   contentElement.classList.add("hide");

//   // Set a timeout to update the content after the fade-out effect completes
//   setTimeout(() => {
//     contentElement.innerHTML = content;

//     // Remove the fade-out class to initiate the fade-in effect
//     contentElement.classList.remove("hide");
//   }, 150); // Adjust the duration to match the transition duration
// }

// testing message from main window
// ipcRenderer.on("message-from-main", (event, message) => {
//   console.log(message); // 'Hello from the main window!'
//   // Do something with the message in the son window
// });
