"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function readDatabase(filePath) {
  const raw = fs.readFileSync(filePath);
  const songs = JSON.parse(raw.toString("utf8"));
  if (!Array.isArray(songs)) throw new Error("قاعدة الترانيم ليست قائمة JSON صالحة.");
  return { songs, revision: crypto.createHash("sha256").update(raw).digest("hex") };
}

function formToSong(form, source = {}) {
  if (!form || typeof form !== "object") throw new Error("بيانات الترنيمة غير صالحة.");
  const title = typeof form.title === "string" ? form.title.trim() : "";
  if (!title) throw new Error("اكتب عنوان الترنيمة.");
  if (!Array.isArray(form.verses) || !Array.isArray(form.chorus)) {
    throw new Error("الأعداد أو القرار غير صالحين.");
  }

  function cleanSlides(slides) {
    if (!Array.isArray(slides) || slides.some((slide) => typeof slide !== "string")) {
      throw new Error("نص إحدى الشرائح غير صالح.");
    }
    return slides.filter((slide) => slide.trim());
  }

  const verses = form.verses.map(cleanSlides).filter((verse) => verse.length);
  const chorus = cleanSlides(form.chorus);
  if (form.chorusEnabled && !chorus.length) throw new Error("أضف شريحة للقرار أو اختر بدون قرار.");
  if (!verses.length && !form.chorusEnabled) throw new Error("أضف شريحة واحدة على الأقل.");

  const song = { ...source, title, verses };
  if (form.chorusEnabled) {
    song.chorus = chorus;
    if (form.chorusFirst || Object.prototype.hasOwnProperty.call(source, "chorusFirst")) {
      song.chorusFirst = Boolean(form.chorusFirst);
    } else {
      delete song.chorusFirst;
    }
  } else {
    delete song.chorus;
    delete song.chorusFirst;
  }

  if (form.scalePresent) {
    if (form.scale !== null && typeof form.scale !== "string") throw new Error("المقام غير صالح.");
    song.scale = form.scale === null || !form.scale.trim() ? null : form.scale.trim();
  } else {
    delete song.scale;
  }

  const metadata = form.metadata || {};
  for (const key of ["formated", "formatted"]) {
    const value = metadata[key];
    if (value === "absent") delete song[key];
    else if (value === "true") song[key] = true;
    else if (value === "false") song[key] = false;
    else throw new Error(`قيمة ${key} غير صالحة.`);
  }

  const last = metadata.lastKnownVerse;
  if (last === "" || last === null) {
    delete song.lastKnownVerse;
  } else {
    const number = Number(last);
    if (!Number.isInteger(number) || number < 1 || number > verses.length) {
      throw new Error("رقم آخر عدد معروف يجب أن يقع ضمن الأعداد الموجودة.");
    }
    song.lastKnownVerse = number;
  }
  return song;
}

function saveSong(filePath, { mode, index, revision, form }) {
  if (!["new", "edit", "duplicate"].includes(mode)) throw new Error("عملية الحفظ غير صالحة.");
  const current = readDatabase(filePath);
  if (revision !== current.revision) {
    const error = new Error("تغيّر ملف الترانيم منذ فتح المحرر. أغلق النموذج ثم أعد فتح الترنيمة قبل الحفظ.");
    error.code = "FILE_CHANGED";
    throw error;
  }
  if (mode !== "new" && (!Number.isInteger(index) || index < 0 || index >= current.songs.length)) {
    throw new Error("لم تعد الترنيمة المحددة موجودة.");
  }

  const source = mode === "new" ? {} : current.songs[index];
  const song = formToSong(form, source);
  let savedIndex;
  if (mode === "edit") {
    current.songs[index] = song;
    savedIndex = index;
  } else if (mode === "duplicate") {
    savedIndex = index + 1;
    current.songs.splice(savedIndex, 0, song);
  } else {
    savedIndex = current.songs.length;
    current.songs.push(song);
  }

  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  try {
    const modeBits = fs.statSync(filePath).mode;
    fs.writeFileSync(tempPath, JSON.stringify(current.songs, null, 4), { encoding: "utf8", flag: "wx", mode: modeBits });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
  return { index: savedIndex, revision: readDatabase(filePath).revision, count: current.songs.length };
}

module.exports = { readDatabase, formToSong, saveSong };
