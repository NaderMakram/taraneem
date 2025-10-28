document.addEventListener("DOMContentLoaded", () => {
  const chorusSlidesContainer = document.getElementById("chorus-slides");
  const addChorusSlideBtn = document.getElementById("add-chorus-slide");
  const versesContainer = document.getElementById("verses-container");
  const addVerseBtn = document.getElementById("add-verse");
  const noChorus = document.getElementById("no-chorus");
  const saveBtn = document.getElementById("save-song");

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
    el.style.height = `calc(${visibleLines} * 1.5em + 2rem)`; // 2rem for vertical padding you use
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
  function addVerse() {
    const verseIndex = versesContainer.children.length + 1;

    const verseBox = document.createElement("div");
    verseBox.className = "verse-box";

    const verseTitle = document.createElement("h4");
    verseTitle.textContent = `عدد ${verseIndex}`;
    verseBox.appendChild(verseTitle);

    const slidesContainer = document.createElement("div");
    slidesContainer.className = "slides-container";
    verseBox.appendChild(slidesContainer);

    // First slide automatically
    slidesContainer.appendChild(createSlideBox("ابدأ بكتابة العدد هنا..."));

    const addSlideBtn = document.createElement("button");
    addSlideBtn.type = "button";
    addSlideBtn.className = "add-new-slide-btn";
    addSlideBtn.innerHTML =
      "أضف شريحة جيدة لهذا العدد<img src='./img/plus.svg' />";
    addSlideBtn.addEventListener("click", () => {
      slidesContainer.appendChild(createSlideBox("اكمل كتابة العدد هنا..."));
    });
    verseBox.appendChild(addSlideBtn);

    // const deleteVerseBtn = document.createElement("button");
    // deleteVerseBtn.type = "button";
    // deleteVerseBtn.className = "delete-verse-btn";
    // deleteVerseBtn.innerHTML = "أحذف العدد<img src='./img/minus-64.png' />";

    // deleteVerseBtn.style.marginTop = "10px";
    // deleteVerseBtn.addEventListener("click", () => {
    //   verseBox.remove();
    //   updateVerseTitles();
    // });
    // verseBox.appendChild(deleteVerseBtn);

    versesContainer.appendChild(verseBox);
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
    console.log(this.checked);
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
  chorusSlidesContainer.appendChild(
    createSlideBox("ابدأ بكتابة القرار هنا...")
  );
  // 1 verse with 1 slide ready
  addVerse();
});
