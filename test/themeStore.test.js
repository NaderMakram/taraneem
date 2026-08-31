const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { fileURLToPath } = require("node:url");

const {
  CUSTOM_THEME_ID_PATTERN,
  createThemeStore,
  normalizeHexColor,
  readImageDimensions,
} = require("../src/themeStore");

const temporaryRoots = new Set();

afterEach(() => {
  const resolvedTempDirectory = path.resolve(os.tmpdir());
  for (const temporaryRoot of temporaryRoots) {
    const resolvedRoot = path.resolve(temporaryRoot);
    assert.ok(resolvedRoot.startsWith(`${resolvedTempDirectory}${path.sep}`));
    fs.rmSync(resolvedRoot, { recursive: true, force: true });
  }
  temporaryRoots.clear();
});

function createFixture() {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "taraneem theme-store-")
  );
  temporaryRoots.add(temporaryRoot);

  return {
    root: temporaryRoot,
    store: createThemeStore(temporaryRoot),
  };
}

function themeInput(overrides = {}) {
  const baseTheme = {
    name: "Sunday theme",
    background: {
      type: "color",
      color: "#15171d",
    },
    textColor: "ffffff",
    accentColor: "#ca2328",
    shadow: {
      enabled: false,
      color: "#000000",
      direction: "bottom-right",
      strength: 3,
      blur: 4,
    },
    fonts: {
      bible: "MyTimesNewRoman",
      song: "MyCalibri",
    },
    alignment: {
      song: { vertical: "top" },
      bible: { horizontal: "right", vertical: "top" },
    },
  };

  return {
    ...baseTheme,
    ...overrides,
    background: {
      ...baseTheme.background,
      ...(overrides.background || {}),
    },
    fonts: {
      ...baseTheme.fonts,
      ...(overrides.fonts || {}),
    },
    alignment: {
      song: {
        ...baseTheme.alignment.song,
        ...(overrides.alignment?.song || {}),
      },
      bible: {
        ...baseTheme.alignment.bible,
        ...(overrides.alignment?.bible || {}),
      },
    },
  };
}

test("normalizes supported hex colors", () => {
  assert.equal(normalizeHexColor("abc"), "#AABBCC");
  assert.equal(normalizeHexColor(" #a1B2c3 "), "#A1B2C3");
  assert.equal(normalizeHexColor("#12"), null);
  assert.equal(normalizeHexColor("#GGGGGG"), null);
  assert.equal(normalizeHexColor(null), null);
});

test("reads PNG, JPEG, and WebP dimensions without decoding image pixels", (t) => {
  const { root } = createFixture(t);

  const pngPath = path.join(root, "dimensions.png");
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(3840, 16);
  png.writeUInt32BE(2160, 20);
  fs.writeFileSync(pngPath, png);

  const jpegPath = path.join(root, "dimensions.jpg");
  const jpeg = Buffer.alloc(21);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[2] = 0xff;
  jpeg[3] = 0xc0;
  jpeg.writeUInt16BE(17, 4);
  jpeg[6] = 8;
  jpeg.writeUInt16BE(1080, 7);
  jpeg.writeUInt16BE(1920, 9);
  fs.writeFileSync(jpegPath, jpeg);

  const webpPath = path.join(root, "dimensions.webp");
  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(22, 4);
  webp.write("WEBP", 8, "ascii");
  webp.write("VP8X", 12, "ascii");
  webp.writeUInt32LE(10, 16);
  webp.writeUIntLE(1919, 24, 3);
  webp.writeUIntLE(1079, 27, 3);
  fs.writeFileSync(webpPath, webp);

  assert.deepEqual(readImageDimensions(pngPath, ".png"), {
    width: 3840,
    height: 2160,
  });
  assert.deepEqual(readImageDimensions(jpegPath, ".jpeg"), {
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(readImageDimensions(webpPath, ".webp"), {
    width: 1920,
    height: 1080,
  });
});

test("creates and edits themes with stable generated IDs", (t) => {
  const { store } = createFixture(t);
  const created = store.saveTheme(themeInput());

  assert.match(created.id, CUSTOM_THEME_ID_PATTERN);
  assert.equal(created.background.color, "#15171D");
  assert.equal(created.textColor, "#FFFFFF");
  assert.equal(created.accentColor, "#CA2328");
  assert.equal(created.background.imageUrl, null);
  assert.deepEqual(created.fonts, {
    bible: "MyTimesNewRoman",
    song: "MyCalibri",
  });
  assert.deepEqual(created.alignment, {
    song: { vertical: "top" },
    bible: { horizontal: "right", vertical: "top" },
  });

  const edited = store.saveTheme(
    themeInput({
      id: created.id,
      name: "Updated theme",
      textColor: "#101010",
      shadow: {
        enabled: true,
        color: "#123456",
        direction: "top-left",
        strength: 6,
        blur: 8,
      },
      fonts: { bible: "traditional-arabic", song: "din-next" },
      alignment: {
        song: { vertical: "center" },
        bible: { horizontal: "center", vertical: "center" },
      },
    })
  );

  assert.equal(edited.id, created.id);
  assert.equal(edited.createdAt, created.createdAt);
  assert.equal(edited.name, "Updated theme");
  assert.deepEqual(edited.shadow, {
    enabled: true,
    color: "#123456",
    direction: "top-left",
    strength: 6,
    blur: 8,
  });
  assert.deepEqual(edited.fonts, {
    bible: "traditional-arabic",
    song: "din-next",
  });
  assert.deepEqual(edited.alignment, {
    song: { vertical: "center" },
    bible: { horizontal: "center", vertical: "center" },
  });
  assert.deepEqual(store.getTheme(created.id), edited);
  assert.equal(store.listThemes().length, 1);

  const document = JSON.parse(
    fs.readFileSync(store.paths.themesFilePath, "utf-8")
  );
  assert.equal(document.version, 1);
  assert.equal(document.themes.length, 1);
  assert.equal(document.themes[0].id, created.id);
  assert.equal(document.themes[0].background.imageFile, null);
  assert.deepEqual(
    fs.readdirSync(store.paths.themesDirectory).filter((name) =>
      name.endsWith(".tmp")
    ),
    []
  );
});

test("preserves Arabic, English, and mixed background names", (t) => {
  const { store } = createFixture(t);
  const names = ["خلفية الشباب", "Youth Night", "Youth اجتماع"];

  const created = names.map((name) =>
    store.saveTheme(themeInput({ name: `  ${name}  ` }))
  );

  assert.deepEqual(
    store.listThemes().map((theme) => theme.name),
    names
  );
  created.forEach((theme, index) => {
    assert.equal(store.getTheme(theme.id).name, names[index]);
  });
});

test("rejects client-selected IDs, duplicate names, and invalid values", (t) => {
  const { store } = createFixture(t);
  store.saveTheme(themeInput({ name: "Alpha" }));

  assert.throws(() => store.saveTheme(themeInput({ name: "alpha" })));
  assert.throws(() =>
    store.saveTheme(themeInput({ id: "custom-client-controlled" }))
  );
  assert.throws(() => store.saveTheme(themeInput({ textColor: "nope" })));
  assert.throws(() => store.saveTheme(themeInput({ shadow: "huge" })));
  assert.throws(() =>
    store.saveTheme(themeInput({ fonts: { song: "unknown-font" } }))
  );
  assert.throws(() =>
    store.saveTheme(
      themeInput({ alignment: { bible: { vertical: "bottom" } } })
    )
  );
  assert.throws(() =>
    store.saveTheme(themeInput({ name: "x".repeat(41) }))
  );
});

test("adds presentation defaults when loading backgrounds saved by older versions", (t) => {
  const { store } = createFixture(t);
  store.listThemes();
  const timestamp = new Date().toISOString();
  const legacyTheme = {
    id: "custom-legacy-background",
    name: "Legacy background",
    background: {
      type: "color",
      color: "#15171D",
      imageFile: null,
    },
    textColor: "#FFFFFF",
    accentColor: "#CA2328",
    shadow: "none",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  fs.writeFileSync(
    store.paths.themesFilePath,
    JSON.stringify({ version: 1, themes: [legacyTheme] }),
    "utf-8"
  );

  const [loadedTheme] = store.listThemes();
  assert.deepEqual(loadedTheme.shadow, {
    enabled: false,
    color: "#000000",
    direction: "bottom-right",
    strength: 3,
    blur: 4,
  });
  assert.deepEqual(loadedTheme.fonts, {
    bible: "MyTimesNewRoman",
    song: "MyCalibri",
  });
  assert.deepEqual(loadedTheme.alignment, {
    song: { vertical: "top" },
    bible: { horizontal: "right", vertical: "top" },
  });
});

test("migrates shared legacy alignment into independent song and Bible values", (t) => {
  const { store } = createFixture(t);
  store.listThemes();
  const timestamp = new Date().toISOString();
  const legacyTheme = {
    id: "custom-legacy-alignment",
    name: "Legacy alignment",
    background: {
      type: "color",
      color: "#15171D",
      imageFile: null,
    },
    textColor: "#FFFFFF",
    accentColor: "#CA2328",
    shadow: "none",
    fonts: {
      bible: "MyTimesNewRoman",
      song: "MyCalibri",
    },
    alignment: {
      horizontal: "center",
      vertical: "center",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  fs.writeFileSync(
    store.paths.themesFilePath,
    JSON.stringify({ version: 1, themes: [legacyTheme] }),
    "utf-8"
  );

  const [loadedTheme] = store.listThemes();
  assert.deepEqual(loadedTheme.alignment, {
    song: { vertical: "center" },
    bible: { horizontal: "center", vertical: "center" },
  });
});

test("copies approved images into durable storage and removes replaced assets", (t) => {
  const { root, store } = createFixture(t);
  const firstSource = path.join(root, "first source.jpg");
  const secondSource = path.join(root, "second source.png");
  fs.writeFileSync(firstSource, Buffer.from("first-image"));
  fs.writeFileSync(secondSource, Buffer.from("second-image"));

  const created = store.saveTheme(
    themeInput({ background: { type: "image" } }),
    firstSource
  );
  const firstStoredPath = fileURLToPath(created.background.imageUrl);

  assert.equal(path.dirname(firstStoredPath), store.paths.imagesDirectory);
  assert.notEqual(path.basename(firstStoredPath), path.basename(firstSource));
  assert.deepEqual(
    fs.readFileSync(firstStoredPath),
    fs.readFileSync(firstSource)
  );

  const updated = store.saveTheme(
    themeInput({
      id: created.id,
      name: created.name,
      background: { type: "image" },
    }),
    secondSource
  );
  const secondStoredPath = fileURLToPath(updated.background.imageUrl);

  assert.notEqual(secondStoredPath, firstStoredPath);
  assert.equal(fs.existsSync(firstStoredPath), false);
  assert.equal(fs.existsSync(secondStoredPath), true);

  const colorTheme = store.saveTheme(
    themeInput({ id: created.id, name: created.name })
  );
  assert.equal(colorTheme.background.type, "color");
  assert.equal(colorTheme.background.imageUrl, null);
  assert.equal(fs.existsSync(secondStoredPath), false);
});

test("requires an available image and removes it after deletion", (t) => {
  const { root, store } = createFixture(t);
  const source = path.join(root, "background.webp");
  fs.writeFileSync(source, Buffer.from("image"));

  const created = store.saveTheme(
    themeInput({ background: { type: "image" } }),
    source
  );
  const storedPath = fileURLToPath(created.background.imageUrl);
  assert.equal(store.deleteTheme(created.id), true);
  assert.equal(fs.existsSync(storedPath), false);
  assert.equal(store.deleteTheme(created.id), false);

  assert.throws(() =>
    store.saveTheme(
      themeInput({
        name: "Missing image",
        background: { type: "image" },
      })
    )
  );

  const unsupportedSource = path.join(root, "background.gif");
  fs.writeFileSync(unsupportedSource, Buffer.from("image"));
  assert.throws(() =>
    store.saveTheme(
      themeInput({
        name: "Unsupported image",
        background: { type: "image" },
      }),
      unsupportedSource
    )
  );
});

test("persists and retries a failed managed-image deletion", (t) => {
  const { root, store } = createFixture(t);
  const source = path.join(root, "locked image.png");
  fs.writeFileSync(source, Buffer.from("image"));

  const created = store.saveTheme(
    themeInput({ background: { type: "image" } }),
    source
  );
  const storedPath = fileURLToPath(created.background.imageUrl);
  const originalUnlinkSync = fs.unlinkSync;
  const originalConsoleError = console.error;
  let shouldFailDeletion = true;

  fs.unlinkSync = (targetPath) => {
    if (
      shouldFailDeletion &&
      path.resolve(targetPath) === path.resolve(storedPath)
    ) {
      shouldFailDeletion = false;
      const error = new Error("File is busy");
      error.code = "EBUSY";
      throw error;
    }
    return originalUnlinkSync(targetPath);
  };
  console.error = () => {};
  try {
    store.saveTheme(themeInput({ id: created.id, name: created.name }));
  } finally {
    fs.unlinkSync = originalUnlinkSync;
    console.error = originalConsoleError;
  }

  assert.equal(fs.existsSync(storedPath), true);
  assert.equal(fs.existsSync(store.paths.pendingImageDeletionsFilePath), true);

  store.listThemes();

  assert.equal(fs.existsSync(storedPath), false);
  assert.equal(fs.existsSync(store.paths.pendingImageDeletionsFilePath), false);
});

test("does not resolve crafted metadata outside the managed images directory", (t) => {
  const { store } = createFixture(t);
  store.listThemes();

  const validShape = {
    id: "custom-safe-id",
    name: "Unsafe image",
    background: {
      type: "image",
      color: "#000000",
      imageFile: "../outside.png",
    },
    textColor: "#FFFFFF",
    accentColor: "#CA2328",
    shadow: "none",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    store.paths.themesFilePath,
    JSON.stringify({ version: 1, themes: [validShape] }),
    "utf-8"
  );

  assert.deepEqual(store.listThemes(), []);
});

test("backs up corrupt metadata once and recovers with an atomic empty document", (t) => {
  const { store } = createFixture(t);
  store.listThemes();
  fs.writeFileSync(store.paths.themesFilePath, "{not-json", "utf-8");

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(store.listThemes(), []);
  } finally {
    console.error = originalConsoleError;
  }

  const recoveredDocument = JSON.parse(
    fs.readFileSync(store.paths.themesFilePath, "utf-8")
  );
  assert.deepEqual(recoveredDocument, { version: 1, themes: [] });

  const backups = fs
    .readdirSync(store.paths.themesDirectory)
    .filter((name) => name.startsWith("themes.corrupt-") && name.endsWith(".json"));
  assert.equal(backups.length, 1);
  assert.deepEqual(store.listThemes(), []);
  assert.equal(
    fs
      .readdirSync(store.paths.themesDirectory)
      .filter((name) => name.startsWith("themes.corrupt-")).length,
    1
  );
});
