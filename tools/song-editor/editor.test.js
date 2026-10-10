"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { normalize, searchSongs } = require("./search");
const { readDatabase, formToSong, saveSong } = require("./store");
const { verifyPackagedApp } = require("./packageGuard");

const baseSongs = [
  { title: "أحبك يا ربي", verses: [["أنت نوري\nوقوتي"]], chorus: ["إلهي الحي"], scale: "Am", formated: true, extra: { keep: 1 } },
  { title: "أحبك يا ربي", verses: [["كلمات أخرى"]], scale: null },
];

function form(song = baseSongs[0]) {
  return {
    title: song.title,
    chorusEnabled: Array.isArray(song.chorus),
    chorusFirst: Boolean(song.chorusFirst),
    chorus: song.chorus ? [...song.chorus] : [],
    verses: song.verses.map((verse) => [...verse]),
    scalePresent: Object.hasOwn(song, "scale"),
    scale: song.scale ?? null,
    metadata: {
      formated: Object.hasOwn(song, "formated") ? String(song.formated) : "absent",
      formatted: Object.hasOwn(song, "formatted") ? String(song.formatted) : "absent",
      lastKnownVerse: song.lastKnownVerse == null ? "" : String(song.lastKnownVerse),
    },
  };
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-editor-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "taraneemDB.json");
  fs.writeFileSync(file, JSON.stringify(baseSongs, null, 4));
  return file;
}

test("search mirrors Arabic normalization and returns distinct duplicate positions", () => {
  assert.equal(normalize("إلهى قُدْرَة"), "الةي كدرة");
  assert.deepEqual(searchSongs(baseSongs, "احبك").map((item) => item.index), [0, 1]);
  assert.notEqual(searchSongs(baseSongs, "احبك")[0].snippet, searchSongs(baseSongs, "احبك")[1].snippet);
  assert.equal(searchSongs(baseSongs, "الهي")[0].matchedIn, "القرار");
  assert.equal(searchSongs(baseSongs, "كوتي")[0].matchedIn, "العدد 1");
});

test("editing keeps unknown metadata and long slides intact", (t) => {
  const file = fixture(t);
  const revision = readDatabase(file).revision;
  const edited = form();
  edited.title = "ترنيمة معدلة";
  edited.verses[0][0] = "سطر\n".repeat(19) + "السطر الأخير";
  saveSong(file, { mode: "edit", index: 0, revision, form: edited });
  const songs = readDatabase(file).songs;
  assert.equal(songs[0].title, "ترنيمة معدلة");
  assert.equal(songs[0].verses[0][0].split("\n").length, 20);
  assert.deepEqual(songs[0].extra, { keep: 1 });
  assert.equal(songs[0].formated, true);
  assert.deepEqual(songs[1], baseSongs[1]);
});

test("duplicate inserts after the selected position and new song appends", (t) => {
  const file = fixture(t);
  let revision = readDatabase(file).revision;
  const duplicate = form();
  duplicate.title = "أحبك يا ربي - نسخة أخرى";
  const copyResult = saveSong(file, { mode: "duplicate", index: 0, revision, form: duplicate });
  assert.equal(copyResult.index, 1);
  assert.equal(readDatabase(file).songs[1].title, duplicate.title);
  assert.equal(readDatabase(file).songs[2].title, baseSongs[1].title);
  revision = copyResult.revision;
  const fresh = form({ title: "جديدة", verses: [["نص"]] });
  const newResult = saveSong(file, { mode: "new", index: null, revision, form: fresh });
  assert.equal(newResult.index, 3);
  assert.equal(readDatabase(file).songs[3].title, "جديدة");
});

test("stale edits do not overwrite an externally changed file", (t) => {
  const file = fixture(t);
  const revision = readDatabase(file).revision;
  const changed = [...baseSongs, { title: "من الخارج", verses: [["نص"]] }];
  fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(() => saveSong(file, { mode: "edit", index: 0, revision, form: form() }), { code: "FILE_CHANGED" });
  assert.deepEqual(readDatabase(file).songs, changed);
});

test("validation allows chorus-only songs but rejects empty content and bad legacy positions", () => {
  const chorusOnly = form();
  chorusOnly.verses = [];
  assert.deepEqual(formToSong(chorusOnly).verses, []);
  const empty = { ...chorusOnly, chorusEnabled: false };
  assert.throws(() => formToSong(empty), /شريحة/);
  const invalidLast = form();
  invalidLast.metadata.lastKnownVerse = "3";
  assert.throws(() => formToSong(invalidLast), /آخر عدد معروف/);
});

test("cancellation dirty check detects changes without mutating form", () => {
  const { isDirty } = require("./formState");
  const draft = form();
  const baseline = JSON.stringify(draft);
  assert.equal(isDirty(draft, baseline), false);
  draft.chorus[0] = "تغيير لم يُحفظ";
  assert.equal(isDirty(draft, baseline), true);
});

test("browser helper and renderer declaration can share one global context", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "formState.js"), "utf8"), context);
  assert.equal(typeof context.window.editorFormState.isDirty, "function");
  assert.doesNotThrow(() => vm.runInContext("const { isDirty } = window.editorFormState;", context));
});

test("package guard rejects editor code in an app archive", async (t) => {
  const asar = require("@electron/asar");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-package-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, "input");
  const appOut = path.join(directory, "app-out");
  const resources = path.join(appOut, "resources");
  fs.mkdirSync(path.join(input, "src"), { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(input, "src", "index.js"), "");
  fs.writeFileSync(path.join(input, "src", "taraneemDB.json"), "[]");
  await asar.createPackage(input, path.join(resources, "app.asar"));
  assert.doesNotThrow(() => verifyPackagedApp(appOut));
  fs.mkdirSync(path.join(input, "tools", "song-editor"), { recursive: true });
  fs.writeFileSync(path.join(input, "tools", "song-editor", "main.js"), "");
  await asar.createPackage(input, path.join(resources, "app.asar"));
  assert.throws(() => verifyPackagedApp(appOut), /Private song editor/);
});
