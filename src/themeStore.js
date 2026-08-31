const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const SCHEMA_VERSION = 1;
const MAX_THEME_NAME_LENGTH = 40;
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const SHADOW_PRESETS = new Set(["none", "light", "dark"]);
const SHADOW_DIRECTIONS = new Set([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);
const DEFAULT_SHADOW = Object.freeze({
  enabled: false,
  color: "#000000",
  direction: "bottom-right",
  strength: 3,
  blur: 4,
});
const FONT_IDS = new Set([
  "ibm-plex",
  "traditional-arabic",
  "din-next",
  "adobe-arabic",
  "MyCalibri",
  "MyTimesNewRoman",
]);
const HORIZONTAL_ALIGNMENTS = new Set(["right", "center"]);
const VERTICAL_ALIGNMENTS = new Set(["top", "center"]);
const DEFAULT_PRESENTATION = Object.freeze({
  fonts: Object.freeze({ bible: "MyTimesNewRoman", song: "MyCalibri" }),
  alignment: Object.freeze({
    song: Object.freeze({ vertical: "top" }),
    bible: Object.freeze({ horizontal: "right", vertical: "top" }),
  }),
});
const CUSTOM_THEME_ID_PATTERN = /^custom-[a-z0-9-]{1,128}$/i;
const IMAGE_FILE_PATTERN = /^[a-z0-9-]{1,260}\.(?:jpe?g|png|webp)$/i;

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;

  let normalized = value.trim();
  if (!normalized.startsWith("#")) normalized = `#${normalized}`;

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    normalized = `#${normalized
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`;
  }

  return /^#[0-9a-f]{6}$/i.test(normalized)
    ? normalized.toUpperCase()
    : null;
}

function normalizeShadowConfiguration(value, fallback = DEFAULT_SHADOW) {
  const useFallback = () => (fallback ? { ...fallback } : null);

  if (SHADOW_PRESETS.has(value)) {
    return {
      ...DEFAULT_SHADOW,
      enabled: value !== "none",
      color: value === "light" ? "#FFFFFF" : "#000000",
    };
  }

  if (!value || typeof value !== "object") return useFallback();

  const color = normalizeHexColor(value.color);
  const strength = Number(value.strength);
  const blur = Number(value.blur);
  if (
    typeof value.enabled !== "boolean" ||
    !color ||
    !SHADOW_DIRECTIONS.has(value.direction) ||
    !Number.isInteger(strength) ||
    strength < 1 ||
    strength > 8 ||
    !Number.isInteger(blur) ||
    blur < 0 ||
    blur > 12
  ) {
    return useFallback();
  }

  return {
    enabled: value.enabled,
    color,
    direction: value.direction,
    strength,
    blur,
  };
}

function validImageDimensions(width, height) {
  return Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0
    ? { width, height }
    : null;
}

function readPngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }
  return validImageDimensions(
    buffer.readUInt32BE(16),
    buffer.readUInt32BE(20)
  );
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return null;

    const marker = buffer[offset];
    offset += 1;
    if (
      marker === 0x01 ||
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      return validImageDimensions(
        buffer.readUInt16BE(offset + 5),
        buffer.readUInt16BE(offset + 3)
      );
    }
    if (marker === 0xda) return null;
    offset += segmentLength;
  }

  return null;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    if (payloadOffset + chunkSize > buffer.length) return null;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return validImageDimensions(
        readUInt24LE(buffer, payloadOffset + 4) + 1,
        readUInt24LE(buffer, payloadOffset + 7) + 1
      );
    }
    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      buffer[payloadOffset + 3] === 0x9d &&
      buffer[payloadOffset + 4] === 0x01 &&
      buffer[payloadOffset + 5] === 0x2a
    ) {
      return validImageDimensions(
        buffer.readUInt16LE(payloadOffset + 6) & 0x3fff,
        buffer.readUInt16LE(payloadOffset + 8) & 0x3fff
      );
    }
    if (
      chunkType === "VP8L" &&
      chunkSize >= 5 &&
      buffer[payloadOffset] === 0x2f
    ) {
      const first = buffer[payloadOffset + 1];
      const second = buffer[payloadOffset + 2];
      const third = buffer[payloadOffset + 3];
      const fourth = buffer[payloadOffset + 4];
      return validImageDimensions(
        1 + first + ((second & 0x3f) << 8),
        1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10)
      );
    }

    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function readImageDimensions(filePath, imageType) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_IMAGE_SIZE_BYTES) {
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  if (imageType === ".png") return readPngDimensions(buffer);
  if (imageType === ".jpeg") return readJpegDimensions(buffer);
  if (imageType === ".webp") return readWebpDimensions(buffer);
  return null;
}

function sanitizeStoredTheme(theme) {
  if (!theme || typeof theme !== "object") return null;

  const name = typeof theme.name === "string" ? theme.name.trim() : "";
  const backgroundType = theme.background?.type;
  const backgroundColor = normalizeHexColor(theme.background?.color);
  const textColor = normalizeHexColor(theme.textColor);
  const accentColor = normalizeHexColor(theme.accentColor);
  const shadow = normalizeShadowConfiguration(theme.shadow);
  const bibleFont = FONT_IDS.has(theme.fonts?.bible)
    ? theme.fonts.bible
    : DEFAULT_PRESENTATION.fonts.bible;
  const songFont = FONT_IDS.has(theme.fonts?.song)
    ? theme.fonts.song
    : DEFAULT_PRESENTATION.fonts.song;
  const legacyHorizontalAlignment = HORIZONTAL_ALIGNMENTS.has(
    theme.alignment?.horizontal
  )
    ? theme.alignment.horizontal
    : null;
  const legacyVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    theme.alignment?.vertical
  )
    ? theme.alignment.vertical
    : null;
  const songVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    theme.alignment?.song?.vertical
  )
    ? theme.alignment.song.vertical
    : legacyVerticalAlignment || DEFAULT_PRESENTATION.alignment.song.vertical;
  const bibleHorizontalAlignment = HORIZONTAL_ALIGNMENTS.has(
    theme.alignment?.bible?.horizontal
  )
    ? theme.alignment.bible.horizontal
    : legacyHorizontalAlignment ||
      DEFAULT_PRESENTATION.alignment.bible.horizontal;
  const bibleVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    theme.alignment?.bible?.vertical
  )
    ? theme.alignment.bible.vertical
    : legacyVerticalAlignment || DEFAULT_PRESENTATION.alignment.bible.vertical;
  const imageFile =
    typeof theme.background?.imageFile === "string" &&
    IMAGE_FILE_PATTERN.test(theme.background.imageFile)
      ? theme.background.imageFile
      : null;

  if (
    typeof theme.id !== "string" ||
    !CUSTOM_THEME_ID_PATTERN.test(theme.id) ||
    !name ||
    name.length > MAX_THEME_NAME_LENGTH ||
    !["color", "image"].includes(backgroundType) ||
    !backgroundColor ||
    !textColor ||
    !accentColor ||
    (backgroundType === "image" && !imageFile)
  ) {
    return null;
  }

  return {
    id: theme.id,
    name,
    background: {
      type: backgroundType,
      color: backgroundColor,
      imageFile: backgroundType === "image" ? imageFile : null,
    },
    textColor,
    accentColor,
    shadow,
    fonts: {
      bible: bibleFont,
      song: songFont,
    },
    alignment: {
      song: { vertical: songVerticalAlignment },
      bible: {
        horizontal: bibleHorizontalAlignment,
        vertical: bibleVerticalAlignment,
      },
    },
    createdAt:
      typeof theme.createdAt === "string"
        ? theme.createdAt
        : new Date(0).toISOString(),
    updatedAt:
      typeof theme.updatedAt === "string"
        ? theme.updatedAt
        : new Date(0).toISOString(),
  };
}

function createThemeStore(userDataPath) {
  if (!userDataPath) throw new Error("A userData path is required");

  const themesDirectory = path.join(userDataPath, "themes");
  const imagesDirectory = path.join(themesDirectory, "images");
  const themesFilePath = path.join(themesDirectory, "themes.json");
  const pendingImageDeletionsFilePath = path.join(
    themesDirectory,
    "pending-image-deletions.txt"
  );

  function ensureStorage() {
    fs.mkdirSync(imagesDirectory, { recursive: true });
    if (!fs.existsSync(themesFilePath)) {
      writeDocument([]);
    }
  }

  function writeDocument(themes) {
    fs.mkdirSync(themesDirectory, { recursive: true });
    const temporaryPath = path.join(
      themesDirectory,
      `themes-${process.pid}-${Date.now()}-${createId()}.tmp`
    );
    const document = {
      version: SCHEMA_VERSION,
      themes,
    };

    let fileDescriptor;
    try {
      fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
      fs.writeFileSync(
        fileDescriptor,
        `${JSON.stringify(document, null, 2)}\n`,
        "utf-8"
      );
      fs.fsyncSync(fileDescriptor);
      fs.closeSync(fileDescriptor);
      fileDescriptor = undefined;
      fs.renameSync(temporaryPath, themesFilePath);
    } catch (error) {
      if (fileDescriptor !== undefined) {
        try {
          fs.closeSync(fileDescriptor);
        } catch (closeError) {
          console.error("Failed to close the temporary themes file", closeError);
        }
      }
      try {
        fs.unlinkSync(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Failed to clean up the temporary themes file", cleanupError);
        }
      }
      throw error;
    }
  }

  function readDocument() {
    ensureStorage();

    try {
      const parsed = JSON.parse(fs.readFileSync(themesFilePath, "utf-8"));
      const rawThemes = Array.isArray(parsed) ? parsed : parsed.themes;
      if (!Array.isArray(rawThemes)) throw new Error("Invalid themes document");

      const themes = rawThemes.map(sanitizeStoredTheme).filter(Boolean);
      retryPendingImageDeletions(themes);
      return themes;
    } catch (error) {
      const backupPath = path.join(
        themesDirectory,
        `themes.corrupt-${Date.now()}.json`
      );
      try {
        fs.renameSync(themesFilePath, backupPath);
      } catch (backupError) {
        console.error("Failed to back up the invalid themes file", backupError);
      }
      console.error("Failed to read custom themes; starting with an empty list", error);
      try {
        writeDocument([]);
      } catch (writeError) {
        console.error("Failed to reset the invalid themes file", writeError);
      }
      return [];
    }
  }

  function resolveImagePath(imageFile) {
    if (typeof imageFile !== "string" || !IMAGE_FILE_PATTERN.test(imageFile)) {
      return null;
    }

    const resolvedImagesDirectory = path.resolve(imagesDirectory);
    const imagePath = path.resolve(resolvedImagesDirectory, imageFile);
    const relativePath = path.relative(resolvedImagesDirectory, imagePath);
    if (
      relativePath.startsWith(`..${path.sep}`) ||
      relativePath === ".." ||
      path.isAbsolute(relativePath)
    ) {
      return null;
    }

    try {
      const stats = fs.lstatSync(imagePath);
      return stats.isFile() && !stats.isSymbolicLink() ? imagePath : null;
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to resolve a custom theme image", error);
      }
      return null;
    }
  }

  function readPendingImageDeletions() {
    try {
      return [
        ...new Set(
          fs
            .readFileSync(pendingImageDeletionsFilePath, "utf-8")
            .split("\n")
            .map((value) => value.trim())
            .filter((value) => IMAGE_FILE_PATTERN.test(value))
        ),
      ];
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to read pending theme image deletions", error);
      }
      return [];
    }
  }

  function writePendingImageDeletions(imageFiles) {
    const uniqueImageFiles = [
      ...new Set(
        imageFiles.filter(
          (imageFile) =>
            typeof imageFile === "string" &&
            IMAGE_FILE_PATTERN.test(imageFile)
        )
      ),
    ];

    if (uniqueImageFiles.length === 0) {
      try {
        fs.unlinkSync(pendingImageDeletionsFilePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Failed to clear pending theme image deletions", error);
        }
      }
      return;
    }

    const temporaryPath = path.join(
      themesDirectory,
      "pending-image-deletions-" +
        process.pid +
        "-" +
        Date.now() +
        "-" +
        createId() +
        ".tmp"
    );
    let fileDescriptor;
    try {
      fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
      fs.writeFileSync(
        fileDescriptor,
        uniqueImageFiles.join("\n") + "\n",
        "utf-8"
      );
      fs.fsyncSync(fileDescriptor);
      fs.closeSync(fileDescriptor);
      fileDescriptor = undefined;
      fs.renameSync(temporaryPath, pendingImageDeletionsFilePath);
    } catch (error) {
      if (fileDescriptor !== undefined) {
        try {
          fs.closeSync(fileDescriptor);
        } catch (closeError) {
          console.error(
            "Failed to close the pending image deletion file",
            closeError
          );
        }
      }
      try {
        fs.unlinkSync(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error(
            "Failed to clean up the pending image deletion file",
            cleanupError
          );
        }
      }
      throw error;
    }
  }

  function queuePendingImageDeletion(imageFile) {
    try {
      const pendingImageFiles = readPendingImageDeletions();
      pendingImageFiles.push(imageFile);
      writePendingImageDeletions(pendingImageFiles);
    } catch (error) {
      console.error("Failed to queue a theme image for deletion", error);
    }
  }

  function retryPendingImageDeletions(themes) {
    const pendingImageFiles = readPendingImageDeletions();
    if (pendingImageFiles.length === 0) return;

    const referencedImageFiles = new Set(
      themes
        .map((theme) => theme.background.imageFile)
        .filter((imageFile) => typeof imageFile === "string")
    );
    const remainingImageFiles = [];

    for (const imageFile of pendingImageFiles) {
      if (referencedImageFiles.has(imageFile)) continue;
      const imagePath = resolveImagePath(imageFile);
      if (!imagePath) continue;

      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          remainingImageFiles.push(imageFile);
          console.error("Failed to retry a theme image deletion", error);
        }
      }
    }

    try {
      writePendingImageDeletions(remainingImageFiles);
    } catch (error) {
      console.error("Failed to update pending theme image deletions", error);
    }
  }

  function removeImageOrQueue(imageFile, failureMessage) {
    const imagePath = resolveImagePath(imageFile);
    if (!imagePath) return;

    try {
      fs.unlinkSync(imagePath);
    } catch (error) {
      if (error.code === "ENOENT") return;
      console.error(failureMessage, error);
      queuePendingImageDeletion(imageFile);
    }
  }

  function toPublicTheme(theme) {
    const imagePath = resolveImagePath(theme.background.imageFile);
    return {
      id: theme.id,
      name: theme.name,
      background: {
        type: theme.background.type,
        color: theme.background.color,
        imageUrl: imagePath ? pathToFileURL(imagePath).href : null,
      },
      textColor: theme.textColor,
      accentColor: theme.accentColor,
      shadow: { ...theme.shadow },
      fonts: { ...theme.fonts },
      alignment: {
        song: { ...theme.alignment.song },
        bible: { ...theme.alignment.bible },
      },
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    };
  }

  function listThemes() {
    return readDocument().map(toPublicTheme);
  }

  function getTheme(themeId) {
    const theme = readDocument().find((item) => item.id === themeId);
    return theme ? toPublicTheme(theme) : null;
  }

  function validateThemeInput(input, existingThemes) {
    if (!input || typeof input !== "object") {
      throw new Error("بيانات الخلفية غير صالحة");
    }

    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > MAX_THEME_NAME_LENGTH) {
      throw new Error(`اسم الخلفية مطلوب وبحد أقصى ${MAX_THEME_NAME_LENGTH} حرفًا`);
    }

    const duplicateName = existingThemes.some(
      (theme) =>
        theme.id !== input.id &&
        theme.name.localeCompare(name, "ar", { sensitivity: "accent" }) === 0
    );
    if (duplicateName) throw new Error("توجد خلفية أخرى بهذا الاسم");

    const backgroundType = input.background?.type;
    if (!["color", "image"].includes(backgroundType)) {
      throw new Error("نوع الخلفية غير صالح");
    }

    const backgroundColor = normalizeHexColor(input.background?.color);
    const textColor = normalizeHexColor(input.textColor);
    const accentColor = normalizeHexColor(input.accentColor);
    if (!backgroundColor || !textColor || !accentColor) {
      throw new Error("أحد ألوان الخلفية غير صالح");
    }

    const shadow = normalizeShadowConfiguration(input.shadow, null);
    if (!shadow) throw new Error("اختيار الظل غير صالح");

    const bibleFont = FONT_IDS.has(input.fonts?.bible)
      ? input.fonts.bible
      : null;
    const songFont = FONT_IDS.has(input.fonts?.song) ? input.fonts.song : null;
    if (!bibleFont || !songFont) {
      throw new Error("اختيار الخط غير صالح");
    }

    const songVerticalAlignment = VERTICAL_ALIGNMENTS.has(
      input.alignment?.song?.vertical
    )
      ? input.alignment.song.vertical
      : null;
    const bibleHorizontalAlignment = HORIZONTAL_ALIGNMENTS.has(
      input.alignment?.bible?.horizontal
    )
      ? input.alignment.bible.horizontal
      : null;
    const bibleVerticalAlignment = VERTICAL_ALIGNMENTS.has(
      input.alignment?.bible?.vertical
    )
      ? input.alignment.bible.vertical
      : null;
    if (
      !songVerticalAlignment ||
      !bibleHorizontalAlignment ||
      !bibleVerticalAlignment
    ) {
      throw new Error("اختيار المحاذاة غير صالح");
    }

    return {
      name,
      backgroundType,
      backgroundColor,
      textColor,
      accentColor,
      shadow,
      bibleFont,
      songFont,
      songVerticalAlignment,
      bibleHorizontalAlignment,
      bibleVerticalAlignment,
    };
  }

  function validateImageSource(imageSourcePath) {
    if (typeof imageSourcePath !== "string") {
      throw new Error("اختر صورة للخلفية");
    }

    const extension = path.extname(imageSourcePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      throw new Error("صيغة الصورة غير مدعومة");
    }

    let stats;
    try {
      stats = fs.statSync(imageSourcePath);
    } catch (error) {
      throw new Error("تعذر قراءة صورة الخلفية");
    }
    if (!stats.isFile() || stats.size === 0 || stats.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("حجم الصورة يجب ألا يتجاوز 20 ميجابايت");
    }

    return extension;
  }

  function saveTheme(input, imageSourcePath = null) {
    const themes = readDocument();
    const existingIndex = input?.id
      ? themes.findIndex((theme) => theme.id === input.id)
      : -1;

    if (input?.id && existingIndex === -1) {
      throw new Error("تعذر العثور على الخلفية المطلوب تعديلها");
    }

    const values = validateThemeInput(input, themes);
    const existingTheme = existingIndex >= 0 ? themes[existingIndex] : null;
    const id = existingTheme?.id || `custom-${createId()}`;
    const now = new Date().toISOString();
    let imageFile = existingTheme?.background.imageFile || null;
    let copiedImagePath = null;

    if (values.backgroundType === "image" && imageSourcePath) {
      const extension = validateImageSource(imageSourcePath);
      imageFile = `${id}-${createId()}${extension}`;
      copiedImagePath = path.join(imagesDirectory, imageFile);
      fs.copyFileSync(imageSourcePath, copiedImagePath);
    } else if (
      values.backgroundType === "image" &&
      (!imageFile || !resolveImagePath(imageFile))
    ) {
      throw new Error("اختر صورة للخلفية");
    } else if (values.backgroundType === "color") {
      imageFile = null;
    }

    const savedTheme = {
      id,
      name: values.name,
      background: {
        type: values.backgroundType,
        color: values.backgroundColor,
        imageFile,
      },
      textColor: values.textColor,
      accentColor: values.accentColor,
      shadow: { ...values.shadow },
      fonts: {
        bible: values.bibleFont,
        song: values.songFont,
      },
      alignment: {
        song: { vertical: values.songVerticalAlignment },
        bible: {
          horizontal: values.bibleHorizontalAlignment,
          vertical: values.bibleVerticalAlignment,
        },
      },
      createdAt: existingTheme?.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) themes[existingIndex] = savedTheme;
    else themes.push(savedTheme);

    try {
      writeDocument(themes);
    } catch (error) {
      if (copiedImagePath && fs.existsSync(copiedImagePath)) {
        fs.unlinkSync(copiedImagePath);
      }
      throw error;
    }

    const previousImageFile = existingTheme?.background.imageFile;
    if (previousImageFile && previousImageFile !== imageFile) {
      removeImageOrQueue(
        previousImageFile,
        "Failed to remove the replaced theme image"
      );
    }

    return toPublicTheme(savedTheme);
  }

  function deleteTheme(themeId) {
    const themes = readDocument();
    const index = themes.findIndex((theme) => theme.id === themeId);
    if (index === -1) return false;

    const [removedTheme] = themes.splice(index, 1);
    writeDocument(themes);

    removeImageOrQueue(
      removedTheme.background.imageFile,
      "Failed to remove the deleted theme image"
    );

    return true;
  }

  return {
    deleteTheme,
    getTheme,
    listThemes,
    saveTheme,
    paths: {
      imagesDirectory,
      pendingImageDeletionsFilePath,
      themesDirectory,
      themesFilePath,
    },
  };
}

module.exports = {
  ALLOWED_IMAGE_EXTENSIONS,
  CUSTOM_THEME_ID_PATTERN,
  DEFAULT_PRESENTATION,
  FONT_IDS,
  HORIZONTAL_ALIGNMENTS,
  IMAGE_FILE_PATTERN,
  MAX_IMAGE_SIZE_BYTES,
  MAX_THEME_NAME_LENGTH,
  SHADOW_DIRECTIONS,
  SHADOW_PRESETS,
  VERTICAL_ALIGNMENTS,
  createThemeStore,
  normalizeHexColor,
  readImageDimensions,
};
