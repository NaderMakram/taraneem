const BUILT_IN_THEMES = [
  {
    id: "dark",
    name: "Dark",
    background: { type: "color", color: "#15171D", imageUrl: null },
    textColor: "#F5F5F5",
    accentColor: "#CA2328",
    shadow: "none",
    fonts: { bible: "MyTimesNewRoman", song: "MyCalibri" },
    alignment: {
      song: { vertical: "center" },
      bible: { horizontal: "right", vertical: "top" },
    },
  },
  {
    id: "black",
    name: "Black",
    background: { type: "color", color: "#000000", imageUrl: null },
    textColor: "#F5F5F5",
    accentColor: "#CA2328",
    shadow: "none",
    fonts: { bible: "MyTimesNewRoman", song: "MyCalibri" },
    alignment: {
      song: { vertical: "center" },
      bible: { horizontal: "right", vertical: "top" },
    },
  },
  {
    id: "light",
    name: "Light",
    background: { type: "color", color: "#F9F9F9", imageUrl: null },
    textColor: "#191919",
    accentColor: "#CA2328",
    shadow: "none",
    fonts: { bible: "MyTimesNewRoman", song: "MyCalibri" },
    alignment: {
      song: { vertical: "center" },
      bible: { horizontal: "right", vertical: "top" },
    },
  },
];

const NEW_THEME_DEFAULTS = {
  id: null,
  name: "",
  background: { type: "color", color: "#15171D", imageUrl: null },
  textColor: "#F5F5F5",
  accentColor: "#CA2328",
  shadow: {
    enabled: false,
    color: "#000000",
    direction: "bottom-right",
    strength: 3,
    blur: 4,
  },
  fonts: { bible: "MyTimesNewRoman", song: "MyCalibri" },
  alignment: {
    song: { vertical: "center" },
    bible: { horizontal: "right", vertical: "top" },
  },
};

const MAX_THEME_NAME_LENGTH = 40;
const LEGACY_SHADOWS = new Set(["none", "light", "dark"]);
const VALID_SHADOW_DIRECTIONS = new Set([
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
const VALID_FONTS = new Set([
  "ibm-plex",
  "traditional-arabic",
  "din-next",
  "adobe-arabic",
  "MyCalibri",
  "MyTimesNewRoman",
]);
const VALID_HORIZONTAL_ALIGNMENTS = new Set(["right", "center"]);
const VALID_VERTICAL_ALIGNMENTS = new Set(["top", "center"]);

let initialized = false;
let customThemes = [];
let activeThemeId = localStorage.getItem("theme") || "dark";
let editingThemeId = null;
let existingImageUrl = null;
let selectedImage = null;
let initialDraftSnapshot = "";
let editorBusy = false;
let refreshSequence = 0;
let toastTimer = null;
let elements = {};

function cloneTheme(theme) {
  const legacyHorizontalAlignment = VALID_HORIZONTAL_ALIGNMENTS.has(
    theme?.alignment?.horizontal
  )
    ? theme.alignment.horizontal
    : null;
  const legacyVerticalAlignment = VALID_VERTICAL_ALIGNMENTS.has(
    theme?.alignment?.vertical
  )
    ? theme.alignment.vertical
    : null;

  return {
    id: theme?.id || null,
    name: typeof theme?.name === "string" ? theme.name : "",
    background: {
      type: theme?.background?.type === "image" ? "image" : "color",
      color: normalizeHex(theme?.background?.color, NEW_THEME_DEFAULTS.background.color),
      imageUrl:
        typeof theme?.background?.imageUrl === "string"
          ? theme.background.imageUrl
          : null,
    },
    textColor: normalizeHex(theme?.textColor, NEW_THEME_DEFAULTS.textColor),
    accentColor: normalizeHex(
      theme?.accentColor,
      NEW_THEME_DEFAULTS.accentColor
    ),
    shadow: normalizeShadow(theme?.shadow),
    fonts: {
      bible: VALID_FONTS.has(theme?.fonts?.bible)
        ? theme.fonts.bible
        : NEW_THEME_DEFAULTS.fonts.bible,
      song: VALID_FONTS.has(theme?.fonts?.song)
        ? theme.fonts.song
        : NEW_THEME_DEFAULTS.fonts.song,
    },
    alignment: {
      song: {
        vertical: VALID_VERTICAL_ALIGNMENTS.has(
          theme?.alignment?.song?.vertical
        )
          ? theme.alignment.song.vertical
          : legacyVerticalAlignment ||
            NEW_THEME_DEFAULTS.alignment.song.vertical,
      },
      bible: {
        horizontal: VALID_HORIZONTAL_ALIGNMENTS.has(
          theme?.alignment?.bible?.horizontal
        )
          ? theme.alignment.bible.horizontal
          : legacyHorizontalAlignment ||
            NEW_THEME_DEFAULTS.alignment.bible.horizontal,
        vertical: VALID_VERTICAL_ALIGNMENTS.has(
          theme?.alignment?.bible?.vertical
        )
          ? theme.alignment.bible.vertical
          : legacyVerticalAlignment ||
            NEW_THEME_DEFAULTS.alignment.bible.vertical,
      },
    },
  };
}

function normalizeHex(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  let raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    raw = raw
      .split("")
      .map((character) => character + character)
      .join("");
  }
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : fallback;
}

function clampShadowNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numericValue)));
}

function normalizeShadow(value) {
  if (LEGACY_SHADOWS.has(value)) {
    return {
      ...DEFAULT_SHADOW,
      enabled: value !== "none",
      color: value === "light" ? "#FFFFFF" : "#000000",
    };
  }

  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SHADOW };
  }

  return {
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : DEFAULT_SHADOW.enabled,
    color: normalizeHex(value.color, DEFAULT_SHADOW.color),
    direction: VALID_SHADOW_DIRECTIONS.has(value.direction)
      ? value.direction
      : DEFAULT_SHADOW.direction,
    strength: clampShadowNumber(
      value.strength,
      1,
      8,
      DEFAULT_SHADOW.strength
    ),
    blur: clampShadowNumber(value.blur, 0, 12, DEFAULT_SHADOW.blur),
  };
}

function getShadowDirectionVector(direction) {
  return {
    "bottom-right": [1, 1],
    "bottom-left": [-1, 1],
    "top-right": [1, -1],
    "top-left": [-1, -1],
  }[direction] || [1, 1];
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex, DEFAULT_SHADOW.color);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

function getShadowCssParts(value, { relative = false } = {}) {
  const shadow = normalizeShadow(value);
  if (!shadow.enabled) return null;

  const [horizontalDirection, verticalDirection] =
    getShadowDirectionVector(shadow.direction);
  const distance = relative
    ? 0.012 + shadow.strength * 0.0075
    : 0.5 + shadow.strength * 0.5;
  const blur = relative ? shadow.blur * 0.012 : shadow.blur * 0.55;
  const alpha = Math.min(0.95, 0.5 + shadow.strength * 0.055);
  const unit = relative ? "em" : "px";
  const formatValue = (number) =>
    `${Number(number.toFixed(relative ? 3 : 1))}${unit}`;

  return {
    x: formatValue(distance * horizontalDirection),
    y: formatValue(distance * verticalDirection),
    blur: formatValue(blur),
    color: hexToRgba(shadow.color, alpha),
  };
}

function getTextShadowCss(value, options) {
  const parts = getShadowCssParts(value, options);
  return parts
    ? `${parts.x} ${parts.y} ${parts.blur} ${parts.color}`
    : "none";
}

function getDropShadowCss(value) {
  const parts = getShadowCssParts(value);
  return parts
    ? `drop-shadow(${parts.x} ${parts.y} ${parts.blur} ${parts.color})`
    : "none";
}

function getHexInputValue(input) {
  return normalizeHex(input?.value || "", null);
}

function toCssImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "none";
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, "");
  return `url("${escaped}")`;
}

function getApiMethod(primaryName, fallbackName) {
  const api = window.myCustomAPI;
  if (api && typeof api[primaryName] === "function") {
    return api[primaryName].bind(api);
  }
  if (fallbackName && api && typeof api[fallbackName] === "function") {
    return api[fallbackName].bind(api);
  }
  return null;
}

function formatError(error, fallback) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  const arabicPart = message
    .split(/:\s*/)
    .reverse()
    .find((part) => /[\u0600-\u06ff]/.test(part));
  return arabicPart?.trim() || fallback;
}

function getThemeById(themeId) {
  return (
    customThemes.find((theme) => theme.id === themeId) ||
    BUILT_IN_THEMES.find((theme) => theme.id === themeId) ||
    null
  );
}

function cacheElements(themeSelect) {
  elements = {
    themeSelect: themeSelect || document.getElementById("theme_select"),
    managementPage: document.querySelector('[data-page="themes-management"]'),
    editorPage: document.querySelector('[data-page="theme-editor"]'),
    customList: document.getElementById("custom-theme-list"),
    customCount: document.getElementById("custom-theme-count"),
    emptyState: document.getElementById("empty-custom-themes"),
    listStatus: document.getElementById("theme-list-status"),
    addButton: document.getElementById("add-theme-button"),
    emptyAddButton: document.getElementById("empty-add-theme-button"),
    form: document.getElementById("theme-editor-form"),
    name: document.getElementById("theme-name"),
    modeLabel: document.getElementById("theme-editor-mode-label"),
    editorHeading: document.getElementById("theme-editor-heading"),
    previewStage: document.getElementById("theme-preview-stage"),
    backgroundColorPanel: document.getElementById(
      "theme-color-background-panel"
    ),
    imagePanel: document.getElementById("theme-image-background-panel"),
    backgroundColor: document.getElementById("theme-background-color"),
    backgroundHex: document.getElementById("theme-background-hex"),
    textColor: document.getElementById("theme-text-color"),
    textHex: document.getElementById("theme-text-hex"),
    accentColor: document.getElementById("theme-accent-color"),
    accentHex: document.getElementById("theme-accent-hex"),
    shadowEnabled: document.getElementById("theme-shadow-enabled"),
    shadowControls: document.getElementById("theme-shadow-controls"),
    shadowColor: document.getElementById("theme-shadow-color"),
    shadowHex: document.getElementById("theme-shadow-hex"),
    shadowStrength: document.getElementById("theme-shadow-strength"),
    shadowStrengthValue: document.getElementById(
      "theme-shadow-strength-value"
    ),
    shadowBlur: document.getElementById("theme-shadow-blur"),
    shadowBlurValue: document.getElementById("theme-shadow-blur-value"),
    songFont: document.getElementById("theme-song-font"),
    bibleFont: document.getElementById("theme-bible-font"),
    songVerticalAlignment: document.getElementById(
      "theme-song-vertical-alignment"
    ),
    songVerticalAlignmentLabel: document.getElementById(
      "theme-song-vertical-alignment-label"
    ),
    bibleHorizontalAlignment: document.getElementById(
      "theme-bible-horizontal-alignment"
    ),
    bibleHorizontalAlignmentLabel: document.getElementById(
      "theme-bible-horizontal-alignment-label"
    ),
    bibleVerticalAlignment: document.getElementById(
      "theme-bible-vertical-alignment"
    ),
    bibleVerticalAlignmentLabel: document.getElementById(
      "theme-bible-vertical-alignment-label"
    ),
    chooseImage: document.getElementById("choose-theme-image"),
    removeImage: document.getElementById("remove-theme-image"),
    imageSummary: document.getElementById("theme-image-summary"),
    imageName: document.getElementById("theme-image-name"),
    imageMeta: document.getElementById("theme-image-meta"),
    imageWarning: document.getElementById("theme-image-warning"),
    imageThumbnail: document.querySelector(".theme-image-thumbnail"),
    editorMessage: document.getElementById("theme-editor-message"),
    saveButton: document.getElementById("save-theme-button"),
    cancelButton: document.getElementById("cancel-theme-edit"),
    deleteButton: document.getElementById("delete-theme-button"),
  };
}

function bindColorInputs(colorInput, hexInput) {
  if (!colorInput || !hexInput) return;

  colorInput.addEventListener("input", () => {
    hexInput.value = colorInput.value.slice(1).toUpperCase();
    hexInput.removeAttribute("aria-invalid");
    updatePreviewAndDirtyState();
    window.requestAnimationFrame(() => colorInput.blur());
  });

  colorInput.addEventListener("change", () => colorInput.blur());

  hexInput.addEventListener("input", () => {
    const clean = hexInput.value
      .trim()
      .replace(/^#/, "")
      .replace(/[^0-9a-f]/gi, "")
      .slice(0, 6)
      .toUpperCase();
    hexInput.value = clean;

    const normalized = normalizeHex(clean, null);
    if (normalized) {
      colorInput.value = normalized;
      hexInput.removeAttribute("aria-invalid");
    } else {
      hexInput.setAttribute("aria-invalid", "true");
    }
    updatePreviewAndDirtyState();
  });

  hexInput.addEventListener("blur", () => {
    const normalized = normalizeHex(hexInput.value, null);
    if (!normalized) return;
    hexInput.value = normalized.slice(1);
    hexInput.removeAttribute("aria-invalid");
  });
}

function bindEvents() {
  bindColorInputs(elements.backgroundColor, elements.backgroundHex);
  bindColorInputs(elements.textColor, elements.textHex);
  bindColorInputs(elements.accentColor, elements.accentHex);
  bindColorInputs(elements.shadowColor, elements.shadowHex);

  elements.shadowEnabled?.addEventListener("change", updateShadowControls);
  elements.shadowStrength?.addEventListener("input", updateShadowRangeValues);
  elements.shadowBlur?.addEventListener("input", updateShadowRangeValues);

  document.addEventListener(
    "pointerdown",
    (event) => {
      const activeElement = document.activeElement;
      if (
        activeElement?.classList?.contains("theme-native-color") &&
        event.target !== activeElement
      ) {
        activeElement.blur();
      }
    },
    true
  );

  elements.themeSelect?.addEventListener("change", async (event) => {
    const requestedThemeId = event.target.value;
    event.target.disabled = true;
    try {
      await setActiveTheme(requestedThemeId, { announce: false });
    } catch (error) {
      console.error("Failed to apply theme", error);
      event.target.value = activeThemeId;
    } finally {
      event.target.disabled = false;
      event.target.blur();
    }
  });

  elements.addButton?.addEventListener("click", () => openEditor(null));
  elements.emptyAddButton?.addEventListener("click", () => openEditor(null));

  elements.form?.addEventListener("input", (event) => {
    if (
      event.target === elements.backgroundHex ||
      event.target === elements.textHex ||
      event.target === elements.accentHex ||
      event.target === elements.shadowHex
    ) {
      return;
    }
    if (event.target === elements.name) {
      elements.name.removeAttribute("aria-invalid");
    }
    updatePreviewAndDirtyState();
  });

  elements.form?.addEventListener("change", () => {
    updatePreviewAndDirtyState();
  });

  elements.songVerticalAlignment?.addEventListener("click", () => {
    const nextValue =
      elements.songVerticalAlignment.value === "top" ? "center" : "top";
    setAlignmentValue("song", "vertical", nextValue);
    updatePreviewAndDirtyState();
  });

  elements.bibleHorizontalAlignment?.addEventListener("click", () => {
    const nextValue =
      elements.bibleHorizontalAlignment.value === "right"
        ? "center"
        : "right";
    setAlignmentValue("bible", "horizontal", nextValue);
    updatePreviewAndDirtyState();
  });

  elements.bibleVerticalAlignment?.addEventListener("click", () => {
    const nextValue =
      elements.bibleVerticalAlignment.value === "top" ? "center" : "top";
    setAlignmentValue("bible", "vertical", nextValue);
    updatePreviewAndDirtyState();
  });

  elements.chooseImage?.addEventListener("click", chooseBackgroundImage);
  elements.removeImage?.addEventListener("click", removeBackgroundImage);
  elements.form?.addEventListener("submit", saveCurrentTheme);
  elements.cancelButton?.addEventListener("click", () => {
    window.settingsModal?.goBack();
  });
  elements.deleteButton?.addEventListener("click", () => {
    if (editingThemeId) {
      deleteThemeById(editingThemeId, { fromEditor: true });
    }
  });
}

function createTextElement(tagName, className, textValue) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = textValue;
  return element;
}

function setCardColors(swatch, theme) {
  const backgroundColor = normalizeHex(theme.background?.color, "#15171D");
  const textColor = normalizeHex(theme.textColor, "#F5F5F5");
  const accentColor = normalizeHex(theme.accentColor, "#CA2328");
  const imageUrl =
    theme.background?.type === "image" ? theme.background?.imageUrl : null;

  swatch.style.setProperty("--card-background-color", backgroundColor);
  swatch.style.setProperty(
    "--card-background-image",
    toCssImageUrl(imageUrl)
  );
  swatch.style.setProperty("--card-text-color", textColor);
  swatch.style.setProperty("--card-accent-color", accentColor);
  swatch.style.setProperty(
    "--card-shadow-filter",
    getDropShadowCss(theme.shadow)
  );
}

function createThemeActionButton(iconSource, className, label, onClick) {
  const button = document.createElement("button");
  const icon = document.createElement("img");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.title = label;
  icon.src = iconSource;
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);
  button.addEventListener("click", onClick);
  return button;
}

function createThemeCard(theme) {
  const card = document.createElement("article");
  card.className = "theme-card";
  card.dataset.themeId = theme.id;
  if (theme.id === activeThemeId) card.classList.add("is-active");

  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "theme-card-swatch";
  swatch.setAttribute("aria-label", `تعديل خلفية ${theme.name}`);
  swatch.title = `تعديل خلفية ${theme.name}`;
  swatch.addEventListener("click", () => openEditor(theme.id));
  setCardColors(swatch, theme);
  swatch.appendChild(document.createElement("span")).className =
    "theme-card-swatch-lines";

  if (theme.id === activeThemeId) {
    swatch.appendChild(
      createTextElement("span", "theme-card-active-badge", "مستخدمة الآن")
    );
  }

  const content = document.createElement("div");
  content.className = "theme-card-content";

  const copy = document.createElement("div");
  copy.className = "theme-card-copy";
  copy.appendChild(createTextElement("strong", "", theme.name));

  const actions = document.createElement("div");
  actions.className = "theme-card-actions";

  const editButton = createThemeActionButton(
    "./img/edit.png",
    "theme-card-action",
    `تعديل خلفية ${theme.name}`,
    () => openEditor(theme.id)
  );
  actions.appendChild(editButton);

  const deleteButton = createThemeActionButton(
    "./img/minus-64.png",
    "theme-card-action is-danger",
    `حذف خلفية ${theme.name}`,
    () => deleteThemeById(theme.id)
  );
  actions.appendChild(deleteButton);

  content.append(copy, actions);
  card.append(swatch, content);
  return card;
}

function renderThemeLists() {
  if (!elements.customList) return;

  const customCards = customThemes.map((theme) => createThemeCard(theme));

  elements.customList.replaceChildren(...customCards);
  elements.emptyState.hidden = customThemes.length > 0;
  elements.customCount.textContent =
    customThemes.length === 0
      ? ""
      : `${customThemes.length.toLocaleString("ar-EG")} خلفية`;
}

function renderThemeDropdown() {
  const select = elements.themeSelect;
  if (!select) return;

  const builtInNames = new Map(
    BUILT_IN_THEMES.map((theme) => [theme.id, theme.name])
  );
  Array.from(select.options).forEach((option) => {
    if (builtInNames.has(option.value)) {
      option.textContent = builtInNames.get(option.value);
    }
  });

  select
    .querySelectorAll('optgroup[data-custom-theme-group="true"]')
    .forEach((group) => group.remove());

  if (customThemes.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "خلفياتي";
    group.dataset.customThemeGroup = "true";
    customThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      group.appendChild(option);
    });
    select.appendChild(group);
  }

  const hasActiveOption = Array.from(select.options).some(
    (option) => option.value === activeThemeId
  );
  select.value = hasActiveOption ? activeThemeId : "dark";
}

function showListStatus(message, isError = false) {
  if (!elements.listStatus) return;
  elements.listStatus.textContent = message;
  elements.listStatus.classList.toggle("is-error", isError);
}

async function refreshThemes({ silent = false } = {}) {
  const requestNumber = ++refreshSequence;
  if (!silent) showListStatus("جارٍ تحميل الخلفيات...");

  const getThemes = getApiMethod("getThemes", "listThemes");
  if (!getThemes) {
    showListStatus("تعذر الوصول إلى الخلفيات المحفوظة على الجهاز.", true);
    renderThemeDropdown();
    renderThemeLists();
    return customThemes;
  }

  try {
    const response = await getThemes();
    if (requestNumber !== refreshSequence) return customThemes;
    const themes = Array.isArray(response)
      ? response
      : Array.isArray(response?.themes)
        ? response.themes
        : [];

    customThemes = themes
      .filter(
        (theme) =>
          theme &&
          typeof theme.id === "string" &&
          typeof theme.name === "string"
      )
      .map((theme) => ({
        ...cloneTheme(theme),
        createdAt: theme.createdAt,
        updatedAt: theme.updatedAt,
      }));

    if (!getThemeById(activeThemeId)) {
      activeThemeId = await applyThemeThroughApi("dark");
      localStorage.setItem("theme", activeThemeId);
    }
    showListStatus("");
  } catch (error) {
    console.error("Failed to load custom themes", error);
    showListStatus("تعذر تحميل الخلفيات المحفوظة. حاول مرة أخرى.", true);
  }

  renderThemeDropdown();
  renderThemeLists();
  return customThemes;
}

async function applyThemeThroughApi(themeId) {
  const applyTheme = getApiMethod("applyTheme");
  if (applyTheme) {
    const resolvedTheme = await applyTheme(themeId);
    const resolvedThemeId =
      typeof resolvedTheme === "string" ? resolvedTheme : resolvedTheme?.id;
    return getThemeById(resolvedThemeId) ? resolvedThemeId : "dark";
  }

  const legacySetTheme = getApiMethod("setTheme");
  if (!legacySetTheme) throw new Error("Theme API is unavailable");
  await legacySetTheme(themeId);
  return themeId;
}

async function setActiveTheme(themeId, { announce = true } = {}) {
  if (!getThemeById(themeId)) {
    throw new Error("Unknown theme");
  }

  activeThemeId = await applyThemeThroughApi(themeId);
  localStorage.setItem("theme", activeThemeId);
  renderThemeDropdown();
  renderThemeLists();

  if (announce) {
    const theme = getThemeById(activeThemeId);
    showToast(`تم استخدام خلفية «${theme.name}»`);
  }
}

function openEditor(themeId) {
  window.settingsModal?.navigateTo("theme-editor", { themeId: themeId || null });
}

function setRadioValue(name, value) {
  const radio = elements.form?.querySelector(
    `input[name="${name}"][value="${value}"]`
  );
  if (radio) radio.checked = true;
}

function getRadioValue(name, fallback) {
  return (
    elements.form?.querySelector(`input[name="${name}"]:checked`)?.value ||
    fallback
  );
}

function setAlignmentValue(target, axis, value) {
  const isHorizontal = axis === "horizontal";
  const controlKey =
    target === "song"
      ? "songVerticalAlignment"
      : isHorizontal
        ? "bibleHorizontalAlignment"
        : "bibleVerticalAlignment";
  const button = elements[controlKey];
  const label = elements[`${controlKey}Label`];
  const validValues = isHorizontal
    ? VALID_HORIZONTAL_ALIGNMENTS
    : VALID_VERTICAL_ALIGNMENTS;
  const fallback = isHorizontal
    ? NEW_THEME_DEFAULTS.alignment.bible.horizontal
    : NEW_THEME_DEFAULTS.alignment[target].vertical;
  const normalizedValue = validValues.has(value) ? value : fallback;
  const arabicLabel =
    normalizedValue === "right"
      ? "يمين"
      : normalizedValue === "top"
        ? "أعلى"
        : "وسط";
  const targetLabel = target === "song" ? "الترانيم" : "الكتاب المقدس";
  const axisLabel = isHorizontal ? "الأفقية" : "الرأسية";

  if (button) {
    button.value = normalizedValue;
    button.setAttribute(
      "aria-label",
      "محاذاة " + targetLabel + " " + axisLabel + ": " + arabicLabel
    );
  }
  if (label) label.textContent = arabicLabel;
}

function setColorValues(colorInput, hexInput, value) {
  const normalized = normalizeHex(value, "#000000");
  colorInput.value = normalized;
  hexInput.value = normalized.slice(1);
  hexInput.removeAttribute("aria-invalid");
}

function getImageFileName(imageUrl) {
  if (!imageUrl) return "";
  try {
    const finalPart = imageUrl.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "";
    return decodeURIComponent(finalPart) || "صورة الخلفية الحالية";
  } catch {
    return "صورة الخلفية الحالية";
  }
}

function updateShadowRangeValues() {
  if (elements.shadowStrengthValue) {
    elements.shadowStrengthValue.textContent = clampShadowNumber(
      elements.shadowStrength?.value,
      1,
      8,
      DEFAULT_SHADOW.strength
    ).toLocaleString("ar-EG");
  }
  if (elements.shadowBlurValue) {
    elements.shadowBlurValue.textContent = clampShadowNumber(
      elements.shadowBlur?.value,
      0,
      12,
      DEFAULT_SHADOW.blur
    ).toLocaleString("ar-EG");
  }
}

function updateShadowControls() {
  if (!elements.shadowControls || !elements.shadowEnabled) return;
  elements.shadowControls.hidden = !elements.shadowEnabled.checked;
}

function setShadowValues(value) {
  const shadow = normalizeShadow(value);
  elements.shadowEnabled.checked = shadow.enabled;
  setColorValues(elements.shadowColor, elements.shadowHex, shadow.color);
  setRadioValue("shadowDirection", shadow.direction);
  elements.shadowStrength.value = String(shadow.strength);
  elements.shadowBlur.value = String(shadow.blur);
  updateShadowRangeValues();
  updateShadowControls();
}

function getShadowValueFromEditor() {
  return normalizeShadow({
    enabled: Boolean(elements.shadowEnabled?.checked),
    color:
      getHexInputValue(elements.shadowHex) ||
      elements.shadowColor?.value ||
      DEFAULT_SHADOW.color,
    direction: getRadioValue(
      "shadowDirection",
      DEFAULT_SHADOW.direction
    ),
    strength: elements.shadowStrength?.value,
    blur: elements.shadowBlur?.value,
  });
}

async function prepareEditor(options = {}) {
  const requestedThemeId =
    typeof options.themeId === "string" ? options.themeId : null;
  let sourceTheme = requestedThemeId
    ? customThemes.find((theme) => theme.id === requestedThemeId)
    : null;

  if (requestedThemeId && !sourceTheme) {
    await refreshThemes({ silent: true });
    sourceTheme = customThemes.find((theme) => theme.id === requestedThemeId);
  }

  if (requestedThemeId && !sourceTheme) {
    showToast("تعذر العثور على الخلفية المطلوبة.");
    window.settingsModal?.goBack({ skipUnsavedGuard: true });
    return;
  }

  const theme = cloneTheme(sourceTheme || NEW_THEME_DEFAULTS);
  editingThemeId = sourceTheme?.id || null;
  existingImageUrl = theme.background.imageUrl;
  selectedImage = null;
  editorBusy = false;

  elements.form?.reset();
  elements.name.value = theme.name;
  elements.name.removeAttribute("aria-invalid");
  setColorValues(
    elements.backgroundColor,
    elements.backgroundHex,
    theme.background.color
  );
  setColorValues(elements.textColor, elements.textHex, theme.textColor);
  setColorValues(elements.accentColor, elements.accentHex, theme.accentColor);
  setRadioValue("backgroundType", theme.background.type);
  setShadowValues(theme.shadow);
  elements.songFont.value = theme.fonts.song;
  elements.bibleFont.value = theme.fonts.bible;
  setAlignmentValue("song", "vertical", theme.alignment.song.vertical);
  setAlignmentValue(
    "bible",
    "horizontal",
    theme.alignment.bible.horizontal
  );
  setAlignmentValue("bible", "vertical", theme.alignment.bible.vertical);

  elements.modeLabel.textContent = editingThemeId
    ? "تعديل خلفية"
    : "خلفية جديدة";
  elements.editorHeading.textContent = editingThemeId
    ? `تعديل «${theme.name}»`
    : "صمّم خلفية خاصة بك";
  elements.saveButton.textContent = editingThemeId
    ? "حفظ التعديلات"
    : "حفظ";
  elements.deleteButton.hidden = !editingThemeId;
  elements.chooseImage.disabled = false;
  hideEditorMessage();

  const settingsTitle = document.getElementById("settings-title");
  if (settingsTitle) {
    settingsTitle.textContent = editingThemeId ? "تعديل الخلفية" : "خلفية جديدة";
  }

  updatePreview();
  initialDraftSnapshot = getDraftSnapshot();
  setEditorBusy(false);

  window.setTimeout(() => elements.name?.focus(), 0);
}

function getDraftSnapshot() {
  const imageIdentity =
    selectedImage?.imageToken ||
    selectedImage?.previewUrl ||
    existingImageUrl ||
    "";
  return JSON.stringify({
    id: editingThemeId,
    name: elements.name?.value || "",
    backgroundType: getRadioValue("backgroundType", "color"),
    backgroundHex: elements.backgroundHex?.value || "",
    textHex: elements.textHex?.value || "",
    accentHex: elements.accentHex?.value || "",
    shadow: getShadowValueFromEditor(),
    songFont: elements.songFont?.value || "",
    bibleFont: elements.bibleFont?.value || "",
    songVerticalAlignment: elements.songVerticalAlignment?.value || "",
    bibleHorizontalAlignment:
      elements.bibleHorizontalAlignment?.value || "",
    bibleVerticalAlignment: elements.bibleVerticalAlignment?.value || "",
    imageIdentity,
  });
}

function hasUnsavedChanges() {
  return Boolean(
    elements.editorPage &&
      !elements.editorPage.hidden &&
      initialDraftSnapshot &&
      getDraftSnapshot() !== initialDraftSnapshot
  );
}

function confirmDiscardChanges() {
  if (!hasUnsavedChanges() || editorBusy) return !editorBusy;
  return window.confirm(
    "لديك تعديلات لم تُحفظ. هل تريد الخروج وفقدان هذه التعديلات؟"
  );
}

function updatePreviewAndDirtyState() {
  updatePreview();
  hideEditorMessage();
}

function updatePreview() {
  if (!elements.previewStage) return;
  const backgroundType = getRadioValue("backgroundType", "color");
  const backgroundColor =
    getHexInputValue(elements.backgroundHex) ||
    elements.backgroundColor?.value ||
    NEW_THEME_DEFAULTS.background.color;
  const textColor =
    getHexInputValue(elements.textHex) ||
    elements.textColor?.value ||
    NEW_THEME_DEFAULTS.textColor;
  const accentColor =
    getHexInputValue(elements.accentHex) ||
    elements.accentColor?.value ||
    NEW_THEME_DEFAULTS.accentColor;
  const shadow = getShadowValueFromEditor();
  const imageUrl = selectedImage?.previewUrl || existingImageUrl;
  const backgroundImage =
    backgroundType === "image" && imageUrl ? toCssImageUrl(imageUrl) : "none";
  const textShadow = getTextShadowCss(shadow);

  elements.previewStage.style.setProperty(
    "--preview-background-color",
    backgroundColor
  );
  elements.previewStage.style.setProperty(
    "--preview-background-image",
    backgroundImage
  );
  elements.previewStage.style.setProperty("--preview-text-color", textColor);
  elements.previewStage.style.setProperty(
    "--preview-accent-color",
    accentColor
  );
  elements.previewStage.style.setProperty(
    "--preview-text-shadow",
    textShadow
  );
  elements.previewStage.dataset.songFont = VALID_FONTS.has(
    elements.songFont?.value
  )
    ? elements.songFont.value
    : NEW_THEME_DEFAULTS.fonts.song;
  elements.previewStage.dataset.bibleFont = VALID_FONTS.has(
    elements.bibleFont?.value
  )
    ? elements.bibleFont.value
    : NEW_THEME_DEFAULTS.fonts.bible;
  elements.previewStage.dataset.songVertical =
    elements.songVerticalAlignment?.value ||
    NEW_THEME_DEFAULTS.alignment.song.vertical;
  elements.previewStage.dataset.bibleHorizontal =
    elements.bibleHorizontalAlignment?.value ||
    NEW_THEME_DEFAULTS.alignment.bible.horizontal;
  elements.previewStage.dataset.bibleVertical =
    elements.bibleVerticalAlignment?.value ||
    NEW_THEME_DEFAULTS.alignment.bible.vertical;

  elements.backgroundColorPanel.hidden = backgroundType !== "color";
  elements.imagePanel.hidden = backgroundType !== "image";
  updateImageSummary(imageUrl);
}

function updateImageSummary(imageUrl) {
  const hasImage = Boolean(imageUrl);
  elements.imageSummary.hidden = !hasImage;
  if (!hasImage) {
    elements.imageThumbnail.style.removeProperty("--theme-thumbnail-image");
    elements.imageName.textContent = "";
    elements.imageMeta.textContent = "";
    return;
  }

  elements.imageThumbnail.style.setProperty(
    "--theme-thumbnail-image",
    toCssImageUrl(imageUrl)
  );
  elements.imageName.textContent =
    selectedImage?.fileName || getImageFileName(imageUrl);
  if (selectedImage?.width && selectedImage?.height) {
    elements.imageMeta.textContent = `${selectedImage.width.toLocaleString(
      "ar-EG"
    )} × ${selectedImage.height.toLocaleString("ar-EG")} بكسل`;
  } else {
    elements.imageMeta.textContent = "صورة الخلفية الحالية";
  }
}

async function chooseBackgroundImage() {
  const chooseThemeImage = getApiMethod(
    "chooseThemeImage",
    "selectThemeImage"
  );
  if (!chooseThemeImage) {
    showEditorMessage("تعذر فتح نافذة اختيار الصور.");
    return;
  }

  elements.chooseImage.disabled = true;
  try {
    const result = await chooseThemeImage();
    if (!result || result.canceled) return;
    if (!result.imageToken || !result.previewUrl) {
      throw new Error("Invalid image selection");
    }

    selectedImage = {
      imageToken: result.imageToken,
      previewUrl: result.previewUrl,
      fileName:
        typeof result.fileName === "string" ? result.fileName : "صورة مختارة",
      width: Number.isFinite(result.width) ? result.width : null,
      height: Number.isFinite(result.height) ? result.height : null,
    };
    elements.imageWarning.hidden = !result.warning;
    elements.imageWarning.textContent = result.warning
      ? "قد تظهر هذه الصورة بجودة أقل من المتوقع على الشاشات الكبيرة."
      : "";
    updatePreviewAndDirtyState();
  } catch (error) {
    console.error("Failed to choose theme image", error);
    showEditorMessage(
      formatError(error, "تعذر اختيار الصورة. جرّب صورة أخرى.")
    );
  } finally {
    elements.chooseImage.disabled = false;
  }
}

function removeBackgroundImage() {
  selectedImage = null;
  existingImageUrl = null;
  elements.imageWarning.hidden = true;
  elements.imageWarning.textContent = "";
  updatePreviewAndDirtyState();
  elements.chooseImage.focus();
}

function validateDraft() {
  const name = elements.name.value.trim();
  const backgroundColor = getHexInputValue(elements.backgroundHex);
  const textColor = getHexInputValue(elements.textHex);
  const accentColor = getHexInputValue(elements.accentHex);
  const shadowEnabled = Boolean(elements.shadowEnabled?.checked);
  const shadowColor = getHexInputValue(elements.shadowHex);
  const shadow = getShadowValueFromEditor();
  const backgroundType = getRadioValue("backgroundType", "color");
  const imageUrl = selectedImage?.previewUrl || existingImageUrl;
  const colorInputs = [
    [backgroundColor, elements.backgroundHex],
    [textColor, elements.textHex],
    [accentColor, elements.accentHex],
  ];
  if (shadowEnabled) {
    colorInputs.push([shadowColor, elements.shadowHex]);
  }

  elements.name.toggleAttribute(
    "aria-invalid",
    !name || name.length > MAX_THEME_NAME_LENGTH
  );
  elements.backgroundHex.toggleAttribute(
    "aria-invalid",
    !backgroundColor
  );
  elements.textHex.toggleAttribute("aria-invalid", !textColor);
  elements.accentHex.toggleAttribute("aria-invalid", !accentColor);
  elements.shadowHex.toggleAttribute(
    "aria-invalid",
    shadowEnabled && !shadowColor
  );

  if (!name) {
    elements.name.focus();
    return { error: "اكتب اسمًا للخلفية قبل الحفظ." };
  }
  if (name.length > MAX_THEME_NAME_LENGTH) {
    elements.name.focus();
    return {
      error: `اسم الخلفية يجب ألا يتجاوز ${MAX_THEME_NAME_LENGTH.toLocaleString(
        "ar-EG"
      )} حرفًا.`,
    };
  }

  const firstInvalidColorInput = colorInputs.find(
    ([color]) => !color
  )?.[1];
  if (firstInvalidColorInput) {
    firstInvalidColorInput.focus();
    return { error: "تأكد أن كل رمز لون يحتوي على ٣ أو ٦ خانات صحيحة." };
  }
  if (backgroundType === "image" && !imageUrl) {
    elements.chooseImage.focus();
    return { error: "اختر صورة لاستخدامها كخلفية." };
  }

  return {
    theme: {
      ...(editingThemeId ? { id: editingThemeId } : {}),
      name,
      background: {
        type: backgroundType,
        color: backgroundColor,
      },
      textColor,
      accentColor,
      shadow: {
        ...shadow,
        color: shadowColor || shadow.color,
      },
      fonts: {
        bible: elements.bibleFont.value,
        song: elements.songFont.value,
      },
      alignment: {
        song: {
          vertical: elements.songVerticalAlignment.value,
        },
        bible: {
          horizontal: elements.bibleHorizontalAlignment.value,
          vertical: elements.bibleVerticalAlignment.value,
        },
      },
    },
  };
}

function setEditorBusy(isBusy) {
  editorBusy = isBusy;
  if (!elements.form) return;
  elements.saveButton.disabled = isBusy;
  elements.cancelButton.disabled = isBusy;
  elements.deleteButton.disabled = isBusy;
  elements.chooseImage.disabled = isBusy;
  elements.songFont.disabled = isBusy;
  elements.bibleFont.disabled = isBusy;
  elements.shadowEnabled.disabled = isBusy;
  elements.shadowColor.disabled = isBusy;
  elements.shadowHex.disabled = isBusy;
  elements.shadowStrength.disabled = isBusy;
  elements.shadowBlur.disabled = isBusy;
  elements.form
    .querySelectorAll('input[name="shadowDirection"]')
    .forEach((input) => {
      input.disabled = isBusy;
    });
  elements.songVerticalAlignment.disabled = isBusy;
  elements.bibleHorizontalAlignment.disabled = isBusy;
  elements.bibleVerticalAlignment.disabled = isBusy;
  elements.saveButton.textContent = isBusy
    ? "جارٍ الحفظ..."
    : editingThemeId
      ? "حفظ التعديلات"
      : "حفظ";
}

async function saveCurrentTheme(event) {
  event.preventDefault();
  if (editorBusy) return;
  hideEditorMessage();

  const validation = validateDraft();
  if (validation.error) {
    showEditorMessage(validation.error);
    return;
  }

  const saveTheme = getApiMethod("saveTheme");
  if (!saveTheme) {
    showEditorMessage("تعذر الوصول إلى مساحة حفظ الخلفيات.");
    return;
  }

  const wasNewTheme = !editingThemeId;
  const wasActiveTheme = editingThemeId === activeThemeId;
  const imageToken =
    validation.theme.background.type === "image"
      ? selectedImage?.imageToken || null
      : null;

  setEditorBusy(true);
  try {
    const savedTheme = await saveTheme(validation.theme, imageToken);
    if (!savedTheme?.id) throw new Error("Invalid saved theme");

    const normalizedSavedTheme = {
      ...cloneTheme(savedTheme),
      createdAt: savedTheme.createdAt,
      updatedAt: savedTheme.updatedAt,
    };
    const existingIndex = customThemes.findIndex(
      (theme) => theme.id === normalizedSavedTheme.id
    );
    if (existingIndex >= 0) {
      customThemes.splice(existingIndex, 1, normalizedSavedTheme);
    } else {
      customThemes.push(normalizedSavedTheme);
    }

    editingThemeId = normalizedSavedTheme.id;
    existingImageUrl = normalizedSavedTheme.background.imageUrl;
    selectedImage = null;
    renderThemeDropdown();

    if (wasActiveTheme) {
      await setActiveTheme(normalizedSavedTheme.id, { announce: false });
    } else {
      renderThemeLists();
    }

    initialDraftSnapshot = getDraftSnapshot();
    showToast(
      wasNewTheme
        ? "تم حفظ الخلفية بنجاح."
        : "تم حفظ تعديلات الخلفية بنجاح."
    );
    window.settingsModal?.goBack({ skipUnsavedGuard: true });
  } catch (error) {
    console.error("Failed to save custom theme", error);
    showEditorMessage(
      formatError(error, "تعذر حفظ الخلفية. راجع البيانات وحاول مرة أخرى.")
    );
  } finally {
    setEditorBusy(false);
  }
}

async function deleteThemeById(themeId, { fromEditor = false } = {}) {
  const theme = customThemes.find((item) => item.id === themeId);
  if (!theme) return;

  const fallbackNotice =
    activeThemeId === themeId
      ? " سيتم الرجوع تلقائيًا إلى الخلفية الداكنة."
      : "";
  const confirmed = window.confirm(
    `هل تريد حذف خلفية «${theme.name}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.${fallbackNotice}`
  );
  if (!confirmed) return;

  const deleteTheme = getApiMethod("deleteTheme");
  if (!deleteTheme) {
    const message = "تعذر الوصول إلى مساحة حفظ الخلفيات.";
    if (fromEditor) showEditorMessage(message);
    else showListStatus(message, true);
    return;
  }

  if (fromEditor) setEditorBusy(true);
  else showListStatus("جارٍ حذف الخلفية...");

  try {
    const response = await deleteTheme(themeId);
    const deleted =
      typeof response === "boolean" ? response : Boolean(response?.deleted);
    if (!deleted) throw new Error("Theme was not deleted");

    customThemes = customThemes.filter((item) => item.id !== themeId);
    if (activeThemeId === themeId) {
      await setActiveTheme("dark", { announce: false });
    } else {
      renderThemeDropdown();
      renderThemeLists();
    }
    showListStatus("");
    showToast("تم حذف الخلفية.");

    if (fromEditor) {
      initialDraftSnapshot = getDraftSnapshot();
      window.settingsModal?.goBack({ skipUnsavedGuard: true });
    }
  } catch (error) {
    console.error("Failed to delete custom theme", error);
    const message = formatError(error, "تعذر حذف الخلفية. حاول مرة أخرى.");
    if (fromEditor) showEditorMessage(message);
    else showListStatus(message, true);
  } finally {
    if (fromEditor) setEditorBusy(false);
  }
}

function showEditorMessage(message, isSuccess = false) {
  elements.editorMessage.textContent = message;
  elements.editorMessage.classList.toggle("is-success", isSuccess);
  elements.editorMessage.hidden = false;
}

function hideEditorMessage() {
  elements.editorMessage.textContent = "";
  elements.editorMessage.classList.remove("is-success");
  elements.editorMessage.hidden = true;
}

function showToast(message) {
  const toast = document.getElementById("toast-notification");
  const toastMessage = toast?.querySelector(".toast-message");
  if (!toast || !toastMessage) return;

  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.classList.remove("fade-out");
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    toast.classList.add("fade-out");
    toast.classList.remove("show");
  }, 2400);
}

async function onPageShown(pageName, options = {}) {
  if (pageName === "themes-management") {
    await refreshThemes();
  } else if (pageName === "theme-editor") {
    await prepareEditor(options);
  }
}

export function initializeThemeManager({ themeSelect } = {}) {
  if (initialized) return window.themeManager;
  cacheElements(themeSelect);
  if (!elements.form || !elements.managementPage) return null;

  bindEvents();
  initialized = true;

  window.themeManager = {
    confirmDiscardChanges,
    hasUnsavedChanges,
    onPageShown,
    refresh: refreshThemes,
    setActiveTheme,
  };

  refreshThemes({ silent: true });
  return window.themeManager;
}
