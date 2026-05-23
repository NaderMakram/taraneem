document.addEventListener("DOMContentLoaded", () => {
  window.addNewSong = {};
  const chorusSlidesContainer = document.getElementById("chorus-slides");
  const addChorusSlideBtn = document.getElementById("add-chorus-slide");
  const versesContainer = document.getElementById("verses-container");
  const addVerseBtn = document.getElementById("add-verse");
  const noChorus = document.getElementById("no-chorus");
  const saveBtn = document.getElementById("save-song");
  const localSongsList = document.getElementById("my-local-songs");

  function resetForm() {
    document.getElementById("song-title").value = "";
    document.getElementById("no-chorus").checked = false;
    document.getElementById("no-chorus").dispatchEvent(new Event("change"));
    document.getElementById("chorus-first").checked = false;
    chorusSlidesContainer.innerHTML = "";
    chorusSlidesContainer.appendChild(
      createSlideBox("ابدأ بكتابة القرار هنا...")
    );
    versesContainer.innerHTML = "";
    addVerse();
    saveBtn.textContent = "حفظ الترنيمة";
    delete saveBtn.dataset.editingId;
    saveBtn.classList.remove("loading");
    saveBtn.disabled = false;
  }

  window.addNewSong.resetForm = resetForm;


  // Utility: limit textareas to 5 lines max
  // Utility: limit textareas to 5 lines and preserve trailing spaces as NBSP
  function limitToFiveLinesAndFixSpaces(el) {
    // preserve selection
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    // split into lines
    const lines = el.value.split("\n");

    // limit lines to 5
    if (lines.length > 5) {
      lines.length = 5;
    }

    // replace trailing normal spaces with NBSP on each line
    // we keep the same length so selection indices don't need major recalculation
    const newLines = lines.map((line) => {
      // replace sequences of normal space at end of line with NBSPs of same length
      return line.replace(/ +$/g, (m) => "\u00A0".repeat(m.length));
    });

    const newVal = newLines.join("\n");

    if (el.value !== newVal) {
      el.value = newVal;
      // restore caret (same indices because replacements keep same length)
      try {
        el.setSelectionRange(selStart, selEnd);
      } catch (e) {
        // ignore if not possible
      }
    }

    // adjust visual height (optional)
    const visibleLines = newLines.length;
    el.style.height = `calc(${visibleLines + 0.25} * 1.5em + 20px)`; // 2rem for vertical padding you use
  }

  // Create Slide Box
  function createSlideBox(placeholder = "اكتب النص هنا...") {
    const slideBox = document.createElement("div");
    slideBox.className = "slide-box";

    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    textarea.className = "slide-textarea";

    // Style constraints
    textarea.style.resize = "none";
    textarea.style.overflow = "hidden";
    textarea.style.lineHeight = "1.5em";
    textarea.rows = 5;

    // Limit input to 5 lines
    textarea.addEventListener("input", () =>
      limitToFiveLinesAndFixSpaces(textarea)
    );

    const delBtn = document.createElement("button");
    delBtn.className = "delete-slide";
    delBtn.innerHTML = "<img src='./img/minus-64.png'/>";

    delBtn.addEventListener("click", () => {
      const slidesContainer = slideBox.parentElement;
      const verseBox = slidesContainer.closest(".verse-box");
      slideBox.remove();

      // Automatically delete verse if it has no slides left
      if (
        slidesContainer.classList.contains("slides-container") &&
        slidesContainer.children.length === 0
      ) {
        verseBox.remove();
        updateVerseTitles();
      }
    });

    slideBox.appendChild(delBtn);
    slideBox.appendChild(textarea);
    return slideBox;
  }

  // Add chorus slide
  addChorusSlideBtn.addEventListener("click", () => {
    chorusSlidesContainer.appendChild(
      createSlideBox("اكمل كتابة القرار هنا...")
    );
  });

  // Add verse
  function addVerse(createDefaultSlide = true) {
    const verseIndex = versesContainer.children.length + 1;

    const verseBox = document.createElement("div");
    verseBox.className = "verse-box";

    const verseTitle = document.createElement("h4");
    verseTitle.textContent = `عدد ${verseIndex}`;
    verseBox.appendChild(verseTitle);

    const slidesContainer = document.createElement("div");
    slidesContainer.className = "slides-container";
    verseBox.appendChild(slidesContainer);

    if (createDefaultSlide) {
      slidesContainer.appendChild(createSlideBox("ابدأ بكتابة العدد هنا..."));
    }

    const addSlideBtn = document.createElement("button");
    addSlideBtn.type = "button";
    addSlideBtn.className = "add-new-slide-btn";
    addSlideBtn.innerHTML =
      "أضف شريحة جيدة لهذا العدد<img src='./img/plus.svg' />";
    addSlideBtn.addEventListener("click", () => {
      slidesContainer.appendChild(createSlideBox("اكمل كتابة العدد هنا..."));
    });
    verseBox.appendChild(addSlideBtn);

    versesContainer.appendChild(verseBox);
    return verseBox;
  }

  addVerseBtn.addEventListener("click", addVerse);

  // Update verse numbering after delete
  function updateVerseTitles() {
    [...versesContainer.children].forEach((verseBox, i) => {
      const title = verseBox.querySelector("h4");
      title.textContent = `عدد ${i + 1}`;
    });
  }

  noChorus.addEventListener("change", function () {
    if (this.checked) {
      document.querySelector("#chorus-title").style.display = "none";
      document.querySelector("#chorus-section").style.display = "none";
      document.querySelector(".chorus-first-wrapper").style.display = "none";
    } else {
      document.querySelector("#chorus-title").style.display = "unset";
      document.querySelector("#chorus-section").style.display = "unset";
      document.querySelector(".chorus-first-wrapper").style.display = "unset";
    }
  });
  // Save

  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("song-title").value.trim();
    if (!title) {
      alert("برجاء إدخال عنوان الترنيمة");
      return;
    }

    const chorusFirst = document.getElementById("chorus-first").checked;
    const noChorus = document.getElementById("no-chorus").checked;

    let chorus = [];
    if (!noChorus) {
      chorus = [...chorusSlidesContainer.querySelectorAll("textarea")]
        .map((ta) => ta.value.trim())
        .filter((t) => t);
    }

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
      verses,
      ...(noChorus ? {} : { chorus }), // ✅ only add `chorus` if not noChorus
    };

    if (noChorus) {
      delete song.chorus;
    }

    const editingId = saveBtn.dataset.editingId;

    saveBtn.classList.add("loading");
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = `
      <span class="btn-text">جار الحفظ...</span>
      <div class="btn-spinner"></div>
    `;

    try {
      if (editingId) {
        await window.myCustomAPI.updateSong(editingId, song);
      } else {
        await window.myCustomAPI.saveSong(song);
      }
      window.myCustomAPI.reloadSongs();
      loadLocalSongs();
      if (window.refreshSearchCache) {
        console.log("Refreshing Search Index...");
        await window.refreshSearchCache();
      }
      showSuccessMessage();
    } catch (err) {
      console.error(`❌ Error ${editingId ? "updating" : "saving"} song:`, err);
      alert(`Failed to ${editingId ? "update" : "save"} song.`);
    } finally {
      saveBtn.classList.remove("loading");
      saveBtn.disabled = false;
      // If we are not redirecting (e.g. error), restore text.
      // If success, showSuccessMessage handles navigation/reset, 
      // but we might need to restore text if staying on page or before transition finishes?
      // Actually showSuccessMessage navigates away or resets form at the end. 
      // Ideally we shouldn't flicker back to "Save" if we are showing success immediately.
      // But `showSuccessMessage` is called in the `try` block. 
      // If error, we definitely want to restore.
      if (!document.querySelector(".success-animation.animate")) {
        saveBtn.textContent = originalText;
      }
    }
  });

  function showSuccessMessage() {
    // Navigate back to list immediately
    window.settingsModal.navigateTo("songs-management");

    // Reset form
    document.getElementById("song-title").value = "";
    chorusSlidesContainer.innerHTML = "";
    chorusSlidesContainer.appendChild(
      createSlideBox("ابدأ بكتابة القرار هنا...")
    );
    versesContainer.innerHTML = "";
    addVerse();
    saveBtn.textContent = "حفظ الترنيمة";
    delete saveBtn.dataset.editingId;

    // Show Notification
    const toast = document.getElementById("toast-notification");
    if (toast) {
      toast.classList.remove("fade-out");
      toast.classList.add("show");

      // Wait 3 seconds then fade out
      setTimeout(() => {
        toast.classList.add("fade-out");

        // Clean up classes after fade out animation
        toast.addEventListener("animationend", () => {
          toast.classList.remove("show", "fade-out");
        }, { once: true });
      }, 3000);
    }
  }

  // --- Initial State ---
  // 1 chorus slide ready
  chorusSlidesContainer.appendChild(
    createSlideBox("ابدأ بكتابة القرار هنا...")
  );
  // 1 verse with 1 slide ready
  addVerse();

  // Load local songs into the list (if any)
  async function loadLocalSongs() {
    try {
      const localSongs = await window.myCustomAPI.getLocalSongs();
      let html = localSongs
        .map(
          (song, index) => `
        <li>
          <span>${song.title}</span>
          <div>
            <button class="edit-local-song" data-song-id="${index}">
                <img src="./img/edit.png" />
            </button>
            <button class="delete-local-song" data-song-id="${index}">
                <img src="./img/minus-64.png" />
            </button>
          </div>
        </li>`
        )
        .join("");
      document.getElementById("my-local-songs").innerHTML = html;
    } catch (error) {
      console.error(error);
    }
  }

  loadLocalSongs();

  localSongsList.addEventListener("click", (e) => {
    const target = e.target;
    if (target.closest(".delete-local-song")) {
      const button = target.closest(".delete-local-song");
      const songId = button.dataset.songId;
      deleteLocalSong(songId);
    } else if (target.closest(".edit-local-song")) {
      const button = target.closest(".edit-local-song");
      const songId = button.dataset.songId;
      populateEditForm(songId);
    }
  });

  async function deleteLocalSong(songId) {
    if (confirm("Are you sure you want to delete this song?")) {
      try {
        await window.myCustomAPI.deleteSong(songId);
        loadLocalSongs();
      } catch (error) {
        console.error("Error deleting song:", error);
        alert("Failed to delete song.");
      }
    }
  }

  async function populateEditForm(songId) {
    try {
      const song = await window.myCustomAPI.getSong(songId);
      document.getElementById("song-title").value = song.title;
      document.getElementById("no-chorus").checked = !song.chorus;
      document.getElementById("no-chorus").dispatchEvent(new Event("change"));
      document.getElementById("chorus-first").checked = song.chorusFirst;

      // Clear existing slides
      chorusSlidesContainer.innerHTML = "";
      versesContainer.innerHTML = "";

      if (song.chorus) {
        song.chorus.forEach((slideText) => {
          const slideBox = createSlideBox();
          const textarea = slideBox.querySelector("textarea");
          textarea.value = slideText;
          limitToFiveLinesAndFixSpaces(textarea);
          chorusSlidesContainer.appendChild(slideBox);
        });
      }

      song.verses.forEach((verse) => {
        const verseBox = addVerse(false);
        const slidesContainer = verseBox.querySelector(".slides-container");
        verse.forEach((slideText) => {
          const slideBox = createSlideBox();
          const textarea = slideBox.querySelector("textarea");
          textarea.value = slideText;
          limitToFiveLinesAndFixSpaces(textarea);
          slidesContainer.appendChild(slideBox);
        });
      });

      saveBtn.textContent = "حفظ التعديلات";
      saveBtn.dataset.editingId = songId;

      window.settingsModal.navigateTo("add-new-song", { isEditing: true });
    } catch (error) {
      console.error("Error populating edit form:", error);
      alert("Failed to load song for editing.");
    }
  }
});
