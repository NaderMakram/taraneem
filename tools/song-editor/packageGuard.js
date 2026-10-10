"use strict";

const fs = require("fs");
const path = require("path");
const asar = require("@electron/asar");

function appArchive(appOutDir) {
  const macApp = fs.readdirSync(appOutDir).find((name) => name.endsWith(".app"));
  return macApp
    ? path.join(appOutDir, macApp, "Contents", "Resources", "app.asar")
    : path.join(appOutDir, "resources", "app.asar");
}

function verifyPackagedApp(appOutDir) {
  const archive = appArchive(appOutDir);
  if (!fs.existsSync(archive)) throw new Error(`Cannot inspect packaged app: ${archive}`);
  asar.uncache(archive);
  const entries = asar.listPackage(archive);
  const privateEntries = entries.filter((entry) => entry === "/tools/song-editor" || entry.startsWith("/tools/song-editor/"));
  const unpacked = path.join(path.dirname(archive), "app.asar.unpacked", "tools", "song-editor");
  const loose = path.join(path.dirname(archive), "app", "tools", "song-editor");
  if (privateEntries.length || fs.existsSync(unpacked) || fs.existsSync(loose)) {
    throw new Error(`Private song editor entered the packaged app: ${privateEntries.slice(0, 5).join(", ") || unpacked}`);
  }
  if (!entries.includes("/src/index.js") || !entries.includes("/src/taraneemDB.json")) {
    throw new Error("Packaged app is missing its normal entry point or song database.");
  }
  return { archive, entries: entries.length };
}

module.exports = async function checkBuilderPackage(context) {
  verifyPackagedApp(context.appOutDir);
};
module.exports.verifyPackagedApp = verifyPackagedApp;
