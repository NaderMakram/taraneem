"use strict";

const { isDirty } = window.editorFormState;

const $ = (selector) => document.querySelector(selector);
const dialog = $("#editor-dialog");
const searchInput = $("#search-input");
const results = $("#results");
const message = $("#list-message");
const formError = $("#form-error");
const editState = { mode: null, index: null, revision: null, form: null, baseline: null, busy: false };
let searchTimer;
let searchSequence = 0;
let toastTimer;
let sortables = [];

const pencilIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10.9-10.9-3.5-3.5L5 15.5 4 20Z"/><path d="m14.8 5.7 3.5 3.5"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

function notify(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

function showError(error) {
  formError.textContent = error?.message || String(error);
  formError.hidden = false;
  formError.scrollIntoView({ block: "nearest" });
}

function blankForm() {
  return {
    title: "", chorusEnabled: true, chorusFirst: false, chorus: [""], verses: [[""]],
    scalePresent: true, scale: null,
    metadata: { formated: "absent", formatted: "absent", lastKnownVerse: "" },
  };
}

function formFromSong(song) {
  return {
    title: song.title || "",
    chorusEnabled: Array.isArray(song.chorus),
    chorusFirst: Boolean(song.chorusFirst),
    chorus: Array.isArray(song.chorus) ? [...song.chorus] : [""],
    verses: Array.isArray(song.verses) ? song.verses.map((verse) => [...verse]) : [],
    scalePresent: Object.prototype.hasOwnProperty.call(song, "scale"),
    scale: song.scale ?? null,
    metadata: {
      formated: Object.prototype.hasOwnProperty.call(song, "formated") ? String(song.formated) : "absent",
      formatted: Object.prototype.hasOwnProperty.call(song, "formatted") ? String(song.formatted) : "absent",
      lastKnownVerse: song.lastKnownVerse == null ? "" : String(song.lastKnownVerse),
    },
  };
}

function lineCount(text) { return text ? text.split("\n").length : 0; }

function actionButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove-content-button";
  const image = document.createElement("img");
  image.src = "../../src/img/minus-64.png";
  image.alt = "";
  button.append(image);
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
}

function dragHandle(label, kind) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `drag-handle ${kind}-drag-handle`;
  button.setAttribute("aria-label", `${label}؛ اسحب أو استخدم سهمي أعلى وأسفل`);
  button.title = `${label} — اسحب أو استخدم سهمي أعلى وأسفل`;
  return button;
}

function sizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 6}px`;
}

function sizeVisibleSlides() {
  dialog.querySelectorAll(".slide-card textarea").forEach((textarea) => {
    if (textarea.getClientRects().length) sizeTextarea(textarea);
  });
}

function moveItem(array, from, to) {
  if (from === to || from < 0 || to < 0 || from >= array.length || to >= array.length) return;
  array.splice(to, 0, array.splice(from, 1)[0]);
}

function attachSortable(container, array, kind) {
  if (array.length < 2) return;
  sortables.push(new Sortable(container, {
    draggable: kind === "verse" ? ".verse-block" : ".slide-card",
    handle: kind === "verse" ? ".verse-drag-handle" : ".slide-drag-handle",
    animation: 220,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    swapThreshold: 1,
    forceFallback: true,
    scroll: true,
    forceAutoScrollFallback: true,
    scrollSensitivity: 100,
    scrollSpeed: 10,
    onEnd: ({ oldIndex, newIndex }) => {
      moveItem(array, oldIndex, newIndex);
      renderSections();
    },
  }));
}

function makeSlide(text, section, verseIndex, slideIndex) {
  const card = document.createElement("div");
  card.className = "slide-card";
  card.dataset.section = section;
  card.dataset.verse = String(verseIndex);
  card.dataset.slide = String(slideIndex);

  const label = `${section === "chorus" ? "القرار" : `العدد ${verseIndex + 1}`}، شريحة ${slideIndex + 1}`;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.rows = 1;
  textarea.placeholder = "اكتب كلمات هذه الشريحة هنا";
  textarea.setAttribute("aria-label", label);
  const warning = document.createElement("p");
  warning.className = "line-warning";
  warning.hidden = lineCount(text) <= 5;
  warning.textContent = `هذه الشريحة تحتوي على ${lineCount(text)} أسطر؛ حد الإضافة في التطبيق هو ٥ أسطر. لن يُحذف أي نص.`;
  card.append(dragHandle(`نقل ${label}`, "slide"), actionButton(`حذف ${label}`, "slide-remove"), textarea, warning);
  return card;
}

function renderSections() {
  sortables.forEach((sortable) => sortable.destroy());
  sortables = [];
  const form = editState.form;
  $("#chorus-section").hidden = !form.chorusEnabled;
  $("#chorus-first").disabled = !form.chorusEnabled;
  const chorusList = $("#chorus-slides");
  chorusList.replaceChildren(...form.chorus.map((text, i) => makeSlide(text, "chorus", -1, i)));

  const verses = $("#verses");
  verses.replaceChildren(...form.verses.map((verse, verseIndex) => {
    const block = document.createElement("div");
    block.className = "verse-block";
    block.dataset.verse = String(verseIndex);
    const label = document.createElement("h4");
    label.textContent = `عدد ${verseIndex + 1}`;
    const slides = document.createElement("div");
    slides.className = "slide-list";
    slides.append(...verse.map((text, slideIndex) => makeSlide(text, "verse", verseIndex, slideIndex)));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-content-button add-inside";
    add.dataset.action = "slide-add";
    add.innerHTML = 'أضف شريحة جديدة لهذا العدد<img src="../../src/img/plus.svg" alt="" />';
    block.append(dragHandle(`نقل العدد ${verseIndex + 1}`, "verse"), actionButton(`حذف العدد ${verseIndex + 1}`, "verse-remove"), label, slides, add);
    return block;
  }));
  if (dialog.open) sizeVisibleSlides();
  attachSortable(chorusList, form.chorus, "slide");
  attachSortable(verses, form.verses, "verse");
  verses.querySelectorAll(".verse-block").forEach((block, index) => {
    attachSortable(block.querySelector(".slide-list"), form.verses[index], "slide");
  });
}

function populateForm() {
  const form = editState.form;
  $("#title-field").value = form.title;
  $("#chorus-enabled").checked = form.chorusEnabled;
  $("#chorus-first").checked = form.chorusFirst;
  $("#scale-present").checked = form.scalePresent;
  $("#scale-field").disabled = !form.scalePresent;
  $("#scale-field").value = form.scale ?? "";
  $("#formated-field").value = form.metadata.formated;
  $("#formatted-field").value = form.metadata.formatted;
  $("#last-known-verse").value = form.metadata.lastKnownVerse;
  formError.hidden = true;
  renderSections();
}

async function openEditor(mode, index = null) {
  try {
    let song;
    let revision;
    if (mode === "new") ({ revision } = await window.songEditor.status());
    else ({ song, revision } = await window.songEditor.getSong(index));
    editState.mode = mode;
    editState.index = index;
    editState.revision = revision;
    editState.form = mode === "new" ? blankForm() : formFromSong(song);
    editState.baseline = JSON.stringify(editState.form);
    $("#editor-mode").textContent = mode === "new" ? "ترنيمة جديدة" : `الترنيمة رقم ${index + 1}`;
    $("#editor-title").textContent = mode === "edit" ? "تعديل الترنيمة" : mode === "duplicate" ? "نسخة جديدة من الترنيمة" : "إضافة ترنيمة";
    $("#save-editor").textContent = mode === "edit" ? "حفظ التعديلات" : mode === "duplicate" ? "حفظ النسخة" : "حفظ الترنيمة";
    populateForm();
    dialog.showModal();
    sizeVisibleSlides();
    $("#title-field").focus();
  } catch (error) {
    notify(error.message || "تعذر فتح الترنيمة.");
  }
}

function closeEditor() {
  if (editState.busy) return;
  if (isDirty(editState.form, editState.baseline) && !window.confirm("لديك تعديلات غير محفوظة. هل تريد إلغاءها؟")) return;
  dialog.close();
  editState.form = null;
}

function handleSectionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || !editState.form) return;
  const action = button.dataset.action;
  const card = button.closest(".slide-card");
  const block = button.closest(".verse-block");
  const verseIndex = card ? Number(card.dataset.verse) : Number(block?.dataset.verse);
  const slides = card?.dataset.section === "chorus" ? editState.form.chorus : editState.form.verses[verseIndex];
  const slideIndex = card ? Number(card.dataset.slide) : -1;

  if (action === "verse-remove") editState.form.verses.splice(verseIndex, 1);
  else if (action === "slide-remove") slides.splice(slideIndex, 1);
  else if (action === "slide-add") editState.form.verses[verseIndex].push("");
  renderSections();
}

function handleDragKeydown(event) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const handle = event.target.closest(".drag-handle");
  if (!handle || !editState.form) return;
  const verseHandle = handle.classList.contains("verse-drag-handle");
  const card = handle.closest(".slide-card");
  const verseIndex = Number(handle.closest(".verse-block")?.dataset.verse);
  const array = verseHandle ? editState.form.verses : card.dataset.section === "chorus" ? editState.form.chorus : editState.form.verses[verseIndex];
  const from = verseHandle ? verseIndex : Number(card.dataset.slide);
  const to = from + (event.key === "ArrowUp" ? -1 : 1);
  if (to < 0 || to >= array.length) return;
  event.preventDefault();
  moveItem(array, from, to);
  renderSections();
  const focusTarget = verseHandle
    ? $("#verses").children[to]?.querySelector(".verse-drag-handle")
    : (card.dataset.section === "chorus" ? $("#chorus-slides") : $("#verses").children[verseIndex]?.querySelector(".slide-list"))?.children[to]?.querySelector(".slide-drag-handle");
  focusTarget?.focus();
}

function handleSlideInput(event) {
  const card = event.target.closest(".slide-card");
  if (!card || event.target.tagName !== "TEXTAREA") return;
  const slides = card.dataset.section === "chorus" ? editState.form.chorus : editState.form.verses[Number(card.dataset.verse)];
  slides[Number(card.dataset.slide)] = event.target.value;
  sizeTextarea(event.target);
  const warning = card.querySelector(".line-warning");
  const lines = lineCount(event.target.value);
  warning.hidden = lines <= 5;
  warning.textContent = `هذه الشريحة تحتوي على ${lines} أسطر؛ حد الإضافة في التطبيق هو ٥ أسطر. لن يُحذف أي نص.`;
}

async function refreshSearch() {
  const sequence = ++searchSequence;
  const query = searchInput.value.trim();
  results.replaceChildren();
  $("#result-count").textContent = "";
  if (!query) {
    message.hidden = false;
    message.textContent = "اكتب كلمة للعثور على ترنيمة.";
    return;
  }
  message.hidden = false;
  message.textContent = "جارٍ البحث…";
  try {
    const data = await window.songEditor.search(query);
    if (sequence !== searchSequence) return;
    $("#result-count").textContent = `${data.results.length} نتيجة${data.results.length === 50 ? " (أول ٥٠)" : ""}`;
    if (!data.results.length) {
      message.textContent = "لا توجد ترنيمة تطابق البحث. جرّب كلمة من القرار أو الأعداد.";
      return;
    }
    message.hidden = true;
    results.append(...data.results.map((item) => {
      const row = document.createElement("article");
      row.className = "result-row";
      const body = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "result-title";
      title.textContent = item.title;
      const meta = document.createElement("p");
      meta.className = "result-meta";
      meta.textContent = `رقم ${item.index + 1} في قاعدة البيانات · تطابق في ${item.matchedIn}`;
      const preview = document.createElement("p");
      preview.className = "result-preview";
      preview.textContent = item.snippet;
      body.append(title, meta, preview);
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button secondary";
      edit.dataset.action = "edit";
      edit.dataset.index = String(item.index);
      edit.innerHTML = `${pencilIcon}تعديل`;
      edit.setAttribute("aria-label", `تعديل ${item.title}، رقم ${item.index + 1}`);
      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = "button secondary";
      duplicate.dataset.action = "duplicate";
      duplicate.dataset.index = String(item.index);
      duplicate.innerHTML = `${copyIcon}نسخ`;
      duplicate.setAttribute("aria-label", `نسخ ${item.title}، رقم ${item.index + 1}`);
      actions.append(edit, duplicate);
      row.append(body, actions);
      return row;
    }));
  } catch (error) {
    message.hidden = false;
    message.textContent = error.message || "تعذر البحث في قاعدة الترانيم.";
  }
}

async function saveEditor() {
  if (editState.busy) return;
  editState.busy = true;
  formError.hidden = true;
  const saveButton = $("#save-editor");
  saveButton.disabled = true;
  const label = saveButton.textContent;
  saveButton.textContent = "جارٍ الحفظ…";
  try {
    const response = await window.songEditor.save({
      mode: editState.mode,
      index: editState.index,
      revision: editState.revision,
      form: editState.form,
    });
    if (!response.ok) throw new Error(response.message);
    dialog.close();
    editState.form = null;
    const status = await window.songEditor.status();
    $("#song-count").textContent = `· ${status.count.toLocaleString("ar-EG")} ترنيمة`;
    await refreshSearch();
    notify("تم حفظ الترنيمة في قاعدة البيانات.");
  } catch (error) {
    showError(error);
  } finally {
    editState.busy = false;
    saveButton.disabled = false;
    saveButton.textContent = label;
  }
}

$("#add-song").addEventListener("click", () => openEditor("new"));
results.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button) openEditor(button.dataset.action, Number(button.dataset.index));
});
searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(refreshSearch, 130); });
$("#cancel-editor").addEventListener("click", closeEditor);
$("#close-editor").addEventListener("click", closeEditor);
dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeEditor(); });
$("#save-editor").addEventListener("click", saveEditor);
$("#title-field").addEventListener("input", (event) => { editState.form.title = event.target.value; });
$("#chorus-enabled").addEventListener("change", (event) => { editState.form.chorusEnabled = event.target.checked; renderSections(); });
$("#chorus-first").addEventListener("change", (event) => { editState.form.chorusFirst = event.target.checked; });
$("#scale-present").addEventListener("change", (event) => { editState.form.scalePresent = event.target.checked; $("#scale-field").disabled = !event.target.checked; });
$("#scale-field").addEventListener("input", (event) => { editState.form.scale = event.target.value; });
$("#formated-field").addEventListener("change", (event) => { editState.form.metadata.formated = event.target.value; });
$("#formatted-field").addEventListener("change", (event) => { editState.form.metadata.formatted = event.target.value; });
$("#last-known-verse").addEventListener("input", (event) => { editState.form.metadata.lastKnownVerse = event.target.value; });
$("#add-chorus-slide").addEventListener("click", () => { editState.form.chorus.push(""); renderSections(); });
$("#add-verse").addEventListener("click", () => { editState.form.verses.push([""]); renderSections(); });
$("#chorus-slides").addEventListener("click", handleSectionAction);
$("#verses").addEventListener("click", handleSectionAction);
$("#chorus-slides").addEventListener("input", handleSlideInput);
$("#verses").addEventListener("input", handleSlideInput);
$("#chorus-slides").addEventListener("keydown", handleDragKeydown);
$("#verses").addEventListener("keydown", handleDragKeydown);
window.addEventListener("resize", () => { if (dialog.open) sizeVisibleSlides(); });

window.songEditor.status().then(({ count }) => {
  $("#song-count").textContent = `· ${count.toLocaleString("ar-EG")} ترنيمة`;
}).catch((error) => {
  message.textContent = error.message || "تعذر قراءة قاعدة الترانيم.";
});
