document.addEventListener("DOMContentLoaded", () => {
  const chorusSlidesContainer = document.getElementById("chorus-slides");
  const addChorusSlideBtn = document.getElementById("add-chorus-slide");
  const versesContainer = document.getElementById("verses-container");
  const addVerseBtn = document.getElementById("add-verse");
  const saveBtn = document.getElementById("save-song");

  // Utility: auto-grow textareas
  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // Create Slide Box
  function createSlideBox(placeholder = "Enter slide text") {
    const slideBox = document.createElement("div");
    slideBox.className = "slide-box";

    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    textarea.addEventListener("input", () => autoGrow(textarea));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-slide";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => slideBox.remove());

    slideBox.appendChild(delBtn);
    slideBox.appendChild(textarea);
    return slideBox;
  }

  // Add chorus slide
  addChorusSlideBtn.addEventListener("click", () => {
    chorusSlidesContainer.appendChild(createSlideBox("Enter chorus slide"));
  });

  // Add verse
  function addVerse() {
    const verseIndex = versesContainer.children.length + 1;

    const verseBox = document.createElement("div");
    verseBox.className = "verse-box";

    const verseTitle = document.createElement("h4");
    verseTitle.textContent = `Verse ${verseIndex}`;
    verseBox.appendChild(verseTitle);

    const slidesContainer = document.createElement("div");
    slidesContainer.className = "slides-container";
    verseBox.appendChild(slidesContainer);

    // First slide automatically
    slidesContainer.appendChild(createSlideBox("Enter verse slide"));

    const addSlideBtn = document.createElement("button");
    addSlideBtn.type = "button";
    addSlideBtn.textContent = "+ Add Verse Slide";
    addSlideBtn.addEventListener("click", () => {
      slidesContainer.appendChild(createSlideBox("Enter verse slide"));
    });
    verseBox.appendChild(addSlideBtn);

    const deleteVerseBtn = document.createElement("button");
    deleteVerseBtn.type = "button";
    deleteVerseBtn.textContent = "Delete Verse";
    deleteVerseBtn.style.marginTop = "10px";
    deleteVerseBtn.addEventListener("click", () => {
      verseBox.remove();
      updateVerseTitles();
    });
    verseBox.appendChild(deleteVerseBtn);

    versesContainer.appendChild(verseBox);
  }

  addVerseBtn.addEventListener("click", addVerse);

  // Update verse numbering after delete
  function updateVerseTitles() {
    [...versesContainer.children].forEach((verseBox, i) => {
      const title = verseBox.querySelector("h4");
      title.textContent = `Verse ${i + 1}`;
    });
  }

  // Save (for now console log)
  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("song-title").value.trim();
    if (!title) {
      alert("Title is required");
      return;
    }

    const chorusFirst = document.getElementById("chorus-first").checked;

    const chorus = [...chorusSlidesContainer.querySelectorAll("textarea")]
      .map((ta) => ta.value.trim())
      .filter((t) => t);

    const verses = [...versesContainer.children]
      .map((verseBox) => {
        const slides = [...verseBox.querySelectorAll(".slide-box textarea")]
          .map((ta) => ta.value.trim())
          .filter((t) => t);
        return slides;
      })
      .filter((v) => v.length);

    const song = {
      title,
      chorusFirst,
      chorus,
      verses,
    };

    try {
      const savedSong = await window.myCustomAPI.saveSong(song);
      window.myCustomAPI.reloadSongs();
      console.log("✅ Song saved:", savedSong);
      alert("Song saved successfully!");
    } catch (err) {
      console.error("❌ Error saving song:", err);
      alert("Failed to save song.");
    }
  });

  // --- Initial State ---
  // 1 chorus slide ready
  chorusSlidesContainer.appendChild(createSlideBox("Enter chorus slide"));
  // 1 verse with 1 slide ready
  addVerse();
});
