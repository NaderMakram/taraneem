"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const asar = require("@electron/asar");
const { verifyPackagedApp } = require("../tools/song-editor/packageGuard");

async function packageFixture(t, files, pathStyle) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taraneem-package-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, "input");
  const output = path.join(directory, "app-out");
  const resources = path.join(output, "resources");
  fs.mkdirSync(resources, { recursive: true });
  for (const file of files) {
    const filePath = path.join(input, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "");
  }
  await asar.createPackage(input, path.join(resources, "app.asar"));

  // Exercise both listing formats on every host, using a real archive.
  const listPackage = asar.listPackage;
  t.mock.method(asar, "listPackage", (archive) =>
    listPackage(archive).map((entry) =>
      path[pathStyle].join("/", ...entry.split(/[\\/]/).filter(Boolean))
    )
  );
  return output;
}

const requiredFiles = ["src/index.js", "src/taraneemDB.json"];
const scenarios = [
  { name: "accepts the normal app", files: requiredFiles },
  {
    name: "rejects private editor files",
    files: [...requiredFiles, "tools/song-editor/main.js"],
    error: /Private song editor entered the packaged app/,
  },
  {
    name: "rejects a missing entry point",
    files: ["src/taraneemDB.json"],
    error: /missing its normal entry point or song database/,
  },
  {
    name: "rejects a missing song database",
    files: ["src/index.js"],
    error: /missing its normal entry point or song database/,
  },
];

for (const pathStyle of ["posix", "win32"]) {
  for (const scenario of scenarios) {
    test(`package guard ${scenario.name} with ${pathStyle} archive paths`, async (t) => {
      const output = await packageFixture(t, scenario.files, pathStyle);
      if (scenario.error) {
        assert.throws(() => verifyPackagedApp(output), scenario.error);
      } else {
        assert.doesNotThrow(() => verifyPackagedApp(output));
      }
    });
  }
}
