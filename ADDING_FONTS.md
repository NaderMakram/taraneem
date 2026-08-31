# Adding a New Font

Fonts are currently bundled with the application. Users cannot upload fonts from
the settings window yet.

Custom backgrounds save only the stable font ID, such as `MyCalibri`; they do
not copy or embed the font file.

## Manual process

### 1. Add the font file

Copy the licensed `.ttf` or `.otf` file to:

```text
src/fonts/
```

Choose a permanent internal ID for it, for example `noto-kufi`. Do not rename
an ID after releasing it because saved custom backgrounds may already reference
that ID.

### 2. Register the font for both windows

Add an `@font-face` declaration to:

- `src/styles/themes.css` for the real song/Bible presentation window.
- `src/styles/theme-editor.css` for the settings preview.

Example:

```css
@font-face {
  font-family: noto-kufi;
  src: url(../fonts/NotoKufiArabic-Bold.ttf);
}
```

### 3. Add it to the selectors

Add an `<option>` with the same ID to both font selectors in
`src/index.html`:

```html
<option value='noto-kufi'>Noto Kufi Arabic</option>
```

The visible name can change later, but the `value` is the permanent saved ID.

### 4. Add the ID to validation

Add the same ID to the supported-font sets in:

- `src/helpers/theme-manager.js`
- `src/themeStore.js`
- `src/songPreload.js`

All three must agree. Otherwise the editor, storage layer, or presentation
window may reject the font and fall back to a default.

### 5. Tune the real presentation

Add song and Bible rules to `src/styles/font-overrides.css`.

For Bible text, also add the font's maximum base size to
`BIBLE_FONT_SIZES` in `src/songPreload.js`. Set the font size and line
height by comparing it with the existing fonts on the actual presentation
window, not only in the small preview.

Example:

```css
body[data-bible-font='noto-kufi'] .bible-container * {
  font-family: noto-kufi !important;
  line-height: 1.35em;
}

body[data-bible-font='noto-kufi'] .bible-body div {
  font-size: 6.8vw;
}

body[data-song-font='noto-kufi'] .song-container * {
  font-family: noto-kufi !important;
  line-height: 1.25em;
}
```

```js
const BIBLE_FONT_SIZES = {
  // Existing fonts...
  'noto-kufi': 6.8,
};
```

### 6. Tune the settings preview

Add matching font-family, approximate size, and line-height rules to
`src/styles/theme-editor.css`. The preview should look proportional to the
real output, while the presentation window remains the source of truth.

### 7. Verify

1. Run `npm test`.
2. Start the app with `npm start`.
3. Create a custom background and select the new font separately for songs and
   Bible verses.
4. Confirm the live preview updates.
5. Save and apply the background, then verify the real presentation window.
6. Restart the app and confirm the selected fonts are restored.
7. Build/package the app once to confirm the font file is included.

## Storage locations

- Bundled font files: `src/fonts/`
- Saved background metadata at runtime:
  `<Electron userData>/themes/themes.json`

The metadata contains font IDs only. Application updates provide new bundled
fonts; the user's saved backgrounds continue to live in the Electron user-data
directory.

## Future automation

A future font-management feature should replace the duplicated manual lists
with one shared font registry containing:

- Permanent ID and display name
- Font filename and format
- Supported use: songs, Bible, or both
- Song and Bible base sizes
- Song and Bible line heights
- Preview tuning values

If users are allowed to upload fonts, the feature must also validate the font
file, copy it into a managed user-data directory, load it safely in both
windows, protect fonts referenced by saved backgrounds, and handle deletion and
fallbacks. Font licensing should be confirmed before distributing or sharing
uploaded font files.
