const { ipcRenderer } = require("electron");

ipcRenderer.on("update-font-size", (event, message) => {
  console.log(parseInt(message));
  document.querySelector("body").style.fontSize = `${parseInt(message)}vw`;
});

const BUILT_IN_THEME_IDS = new Set([
  "light",
  "dark",
  "black",
  "wedding1",
  "wedding2",
  "christmas",
  "christmas-simple",
  "christmas-dark",
  "christmas-dark-simple",
  "elsoora-light",
  "elsoora-dark",
]);
const CUSTOM_THEME_STYLE_ID = "custom-theme-runtime-styles";
const CUSTOM_THEME_PROPERTIES = [
  "color",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
];
const CUSTOM_THEME_VARIABLES = [
  "--custom-theme-background-color",
  "--custom-theme-background-image",
  "--custom-theme-text-color",
  "--custom-theme-accent-color",
  "--custom-theme-text-shadow",
];
const LEGACY_SHADOW_VALUES = new Set(["none", "light", "dark"]);
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
const DEFAULT_PRESENTATION = {
  fonts: { bible: "MyTimesNewRoman", song: "MyCalibri" },
  alignment: {
    song: { vertical: "center" },
    bible: { horizontal: "right", vertical: "top" },
  },
};
let pendingThemePayload = null;

function ensureCustomThemeStyles() {
  if (document.getElementById(CUSTOM_THEME_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = CUSTOM_THEME_STYLE_ID;
  style.textContent = `
    body[data-custom-theme="true"] {
      color: var(--custom-theme-text-color) !important;
      background-color: var(--custom-theme-background-color) !important;
      background-image: var(--custom-theme-background-image) !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }

    body[data-custom-theme="true"] #content,
    body[data-custom-theme="true"] #content * {
      text-shadow: var(--custom-theme-text-shadow, none) !important;
    }

    body[data-custom-theme="true"] .chorusSymbol,
    body[data-custom-theme="true"] .verseNumber,
    body[data-custom-theme="true"] .verse-number-center,
    body[data-custom-theme="true"] .bible-head {
      color: var(--custom-theme-accent-color) !important;
    }
  `;
  document.head.appendChild(style);
}

function resetCustomThemeStyles() {
  document.body.removeAttribute("data-custom-theme");
  document.body.removeAttribute("data-custom-theme-id");
  for (const property of CUSTOM_THEME_PROPERTIES) {
    document.body.style.removeProperty(property);
  }
  for (const property of CUSTOM_THEME_VARIABLES) {
    document.documentElement.style.removeProperty(property);
  }
}

function safeFileUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "file:" ? url.href : null;
  } catch (error) {
    return null;
  }
}

function applyPresentationPreferences(payload) {
  const bibleFont = FONT_IDS.has(payload?.fonts?.bible)
    ? payload.fonts.bible
    : DEFAULT_PRESENTATION.fonts.bible;
  const songFont = FONT_IDS.has(payload?.fonts?.song)
    ? payload.fonts.song
    : DEFAULT_PRESENTATION.fonts.song;
  const legacyHorizontalAlignment = HORIZONTAL_ALIGNMENTS.has(
    payload?.alignment?.horizontal
  )
    ? payload.alignment.horizontal
    : null;
  const legacyVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    payload?.alignment?.vertical
  )
    ? payload.alignment.vertical
    : null;
  const songVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    payload?.alignment?.song?.vertical
  )
    ? payload.alignment.song.vertical
    : legacyVerticalAlignment || DEFAULT_PRESENTATION.alignment.song.vertical;
  const bibleHorizontalAlignment = HORIZONTAL_ALIGNMENTS.has(
    payload?.alignment?.bible?.horizontal
  )
    ? payload.alignment.bible.horizontal
    : legacyHorizontalAlignment ||
      DEFAULT_PRESENTATION.alignment.bible.horizontal;
  const bibleVerticalAlignment = VERTICAL_ALIGNMENTS.has(
    payload?.alignment?.bible?.vertical
  )
    ? payload.alignment.bible.vertical
    : legacyVerticalAlignment || DEFAULT_PRESENTATION.alignment.bible.vertical;

  document.body.setAttribute("data-bible-font", bibleFont);
  document.body.setAttribute("data-song-font", songFont);
  document.body.removeAttribute("data-alignment");
  document.body.removeAttribute("data-vert-alignment");
  document.body.setAttribute(
    "data-bible-alignment",
    bibleHorizontalAlignment
  );
  document.body.setAttribute(
    "data-song-vert-alignment",
    songVerticalAlignment
  );
  document.body.setAttribute(
    "data-bible-vert-alignment",
    bibleVerticalAlignment
  );

  const bibleText = document.querySelector(".bible-body div");
  if (bibleText) {
    bibleText.style.fontSize = `${getBibleMaxFontSize()}vw`;
    window.requestAnimationFrame(adjustFontSizeToFit);
  }
}

function normalizeShadow(value) {
  if (LEGACY_SHADOW_VALUES.has(value)) {
    return {
      ...DEFAULT_SHADOW,
      enabled: value !== "none",
      color: value === "light" ? "#FFFFFF" : "#000000",
    };
  }

  if (!value || typeof value !== "object") return null;

  const colorPattern = /^#[0-9A-F]{6}$/i;
  const strength = Number(value.strength);
  const blur = Number(value.blur);
  if (
    typeof value.enabled !== "boolean" ||
    !colorPattern.test(value.color) ||
    !SHADOW_DIRECTIONS.has(value.direction) ||
    !Number.isInteger(strength) ||
    strength < 1 ||
    strength > 8 ||
    !Number.isInteger(blur) ||
    blur < 0 ||
    blur > 12
  ) {
    return null;
  }

  return {
    enabled: value.enabled,
    color: value.color.toUpperCase(),
    direction: value.direction,
    strength,
    blur,
  };
}

function shadowColorToRgba(hex, alpha) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

function getTextShadowValue(value) {
  const shadow = normalizeShadow(value);
  if (!shadow?.enabled) return "none";

  const [horizontalDirection, verticalDirection] = {
    "bottom-right": [1, 1],
    "bottom-left": [-1, 1],
    "top-right": [1, -1],
    "top-left": [-1, -1],
  }[shadow.direction];
  const distance = 0.012 + shadow.strength * 0.0075;
  const blur = shadow.blur * 0.012;
  const alpha = Math.min(0.95, 0.5 + shadow.strength * 0.055);
  const formatValue = (number) => `${Number(number.toFixed(3))}em`;

  return [
    formatValue(distance * horizontalDirection),
    formatValue(distance * verticalDirection),
    formatValue(blur),
    shadowColorToRgba(shadow.color, alpha),
  ].join(" ");
}

function applyThemePayload(payload) {
  resetCustomThemeStyles();
  applyPresentationPreferences(payload);

  if (typeof payload === "string") {
    document.body.setAttribute(
      "data-theme",
      BUILT_IN_THEME_IDS.has(payload) ? payload : "dark"
    );
    return;
  }

  if (
    !payload ||
    payload.kind === "builtin" ||
    typeof payload.id !== "string" ||
    !payload.id.startsWith("custom-")
  ) {
    const builtInId = BUILT_IN_THEME_IDS.has(payload?.id) ? payload.id : "dark";
    document.body.setAttribute("data-theme", builtInId);
    return;
  }

  const colorPattern = /^#[0-9A-F]{6}$/i;
  const backgroundColor = payload.background?.color;
  const shadow = normalizeShadow(payload.shadow);
  if (
    !colorPattern.test(backgroundColor) ||
    !colorPattern.test(payload.textColor) ||
    !colorPattern.test(payload.accentColor) ||
    !shadow
  ) {
    document.body.setAttribute("data-theme", "dark");
    return;
  }

  ensureCustomThemeStyles();
  const imageUrl =
    payload.background?.type === "image"
      ? safeFileUrl(payload.background.imageUrl)
      : null;

  document.body.setAttribute("data-theme", "custom");
  document.body.setAttribute("data-custom-theme", "true");
  document.body.setAttribute("data-custom-theme-id", payload.id);
  document.documentElement.style.setProperty(
    "--custom-theme-background-color",
    backgroundColor
  );
  document.documentElement.style.setProperty(
    "--custom-theme-background-image",
    imageUrl ? `url("${imageUrl}")` : "none"
  );
  document.documentElement.style.setProperty(
    "--custom-theme-text-color",
    payload.textColor
  );
  document.documentElement.style.setProperty(
    "--custom-theme-accent-color",
    payload.accentColor
  );
  document.documentElement.style.setProperty(
    "--custom-theme-text-shadow",
    getTextShadowValue(shadow)
  );
}

function setPresentationTheme(payload) {
  pendingThemePayload = payload;
  if (!document.body) return;
  applyThemePayload(pendingThemePayload);
  pendingThemePayload = null;
}

document.addEventListener("DOMContentLoaded", () => {
  if (pendingThemePayload !== null) {
    setPresentationTheme(pendingThemePayload);
  }
});

ipcRenderer.on("set-theme", (_event, theme) => {
  setPresentationTheme(theme);
});

ipcRenderer.on("update-font-weight", (event, message) => {
  document.querySelector("#content").classList.toggle("bold");
});

// default font sizes for each font
// Keys match the font IDs stored with each custom background.
const BIBLE_FONT_SIZES = {
  "ibm-plex": 7,
  "traditional-arabic": 8,
  "din-next": 6,
  "adobe-arabic": 9.5,
  "MyCalibri": 7.3,
  "MyTimesNewRoman": 7.3,
};

const DEFAULT_BIBLE_FONT_SIZE = 7.3;

function getBibleMaxFontSize() {
  const currentFont = document.body.getAttribute("data-bible-font");
  if (currentFont && BIBLE_FONT_SIZES[currentFont]) {
    return BIBLE_FONT_SIZES[currentFont];
  }
  return DEFAULT_BIBLE_FONT_SIZE;
}

ipcRenderer.on("update-song-window", (event, content, isBible) => {
  // console.log(isBible);
  if (isBible) {
    // reset html font size
    let text = document.querySelector(".bible-body div");
    if (text) {
      const maxFontSize = getBibleMaxFontSize();
      text.style.fontSize = `${maxFontSize}vw`;
    }
    // update slide
    const contentElement = document.getElementById("content");
    contentElement.innerHTML = content;
    // adjust slide if needed
    adjustFontSizeToFit();
  } else {
    fadeContent(content);
  }
});

function fadeContent(content) {
  const contentElement = document.getElementById("content");

  // Add the fade-out class to initiate the fade-out effect
  contentElement.classList.remove("show");

  // Set a timeout to update the content after the fade-out effect completes
  setTimeout(() => {
    contentElement.innerHTML = content;

    // Add the fade-in class to initiate the fade-in effect
    contentElement.classList.add("show");
  }, 150); // Adjust the duration to match the transition duration
}

// bible font size
function adjustFontSizeToFit() {
  let container = document.querySelector(".bible-body");
  let text = document.querySelector(".bible-body div");
  let html = document.querySelector("html");
  let fontSize = parseFloat(window.getComputedStyle(text).fontSize); // Get the computed font size in vw

  // Reduce font size until text fits within container
  if (fontSize && container && text.scrollHeight > container.offsetHeight) {
    console.time("OptimizedFontSizeCalculation"); // Start measuring time for the optimized font size calculation

    let minFontSize = 4; // Minimum font size
    let maxFontSize = getBibleMaxFontSize(); // Maximum font size (adjust as needed)
    let finalFontSize = -1; // Variable to store the final font size

    // Binary search for the optimal font size
    while (minFontSize <= maxFontSize) {
      const midFontSize = (minFontSize + maxFontSize) / 2; // Calculate the middle font size
      text.style.fontSize = `${midFontSize}vw`; // Set the font size
      // console.log(midFontSize);

      // Check if the text fits within the container
      if (
        text.scrollWidth <= container.offsetWidth &&
        text.scrollHeight <= container.offsetHeight
      ) {
        finalFontSize = midFontSize; // Update the final font size
        minFontSize = midFontSize + 0.1; // Continue searching for larger font size
      } else {
        maxFontSize = midFontSize - 0.1; // Continue searching for smaller font size
      }
    }

    // Apply the final font size
    text.style.fontSize = `${finalFontSize}vw`;

    console.timeEnd("OptimizedFontSizeCalculation"); // End measuring time for the optimized font size calculation and print the result
  }
}
