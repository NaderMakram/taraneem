// These are the family names inside the bundled font files, rather than CSS aliases.
const FONT_FAMILIES = {
  MyCalibri: { fontFace: 'Calibri', bold: true },
  MyTimesNewRoman: { fontFace: 'Times New Roman', bold: true },
  'ibm-plex': { fontFace: 'IBM Plex Sans Arabic SemiBold', bold: false },
  'traditional-arabic': { fontFace: 'Traditional Arabic', bold: true },
  'din-next': { fontFace: 'DIN Next LT Arabic', bold: true },
  'adobe-arabic': { fontFace: 'Adobe Arabic', bold: true },
  'mySegoe-ui': { fontFace: 'Segoe UI', bold: false },
};

function cssColorToHex(value) {
  const channels = value.match(/[\d.]+/g);
  if (!channels || channels.length < 3) throw new Error('Invalid presentation text color');
  return channels.slice(0, 3).map(channel => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function textOptions(box, layout) {
  const scale = layout.width / layout.pixels[0];
  const points = scale * 72;
  const font = FONT_FAMILIES[box.fontFamily.split(',')[0].trim().replace(/["']/g, '')] || FONT_FAMILIES.MyCalibri;
  // Give PowerPoint a little horizontal room for differences in font metrics.
  // Browser wrapping has already been resolved into individual editable lines.
  const padding = box.fontSize * 0.1;
  const options = {
    x: (box.x - padding) * scale, y: box.y * scale,
    w: (box.width + padding * 2) * scale, h: box.height * scale,
    fontFace: font.fontFace, fontSize: box.fontSize * points,
    bold: font.bold || Number(box.fontWeight) >= 600,
    italic: box.fontStyle === 'italic', color: cssColorToHex(box.color),
    align: 'center', valign: 'mid', rtlMode: true, lang: 'ar-SA',
    margin: 0, paraSpaceAfter: 0, paraSpaceBefore: 0,
    wrap: false, fit: 'none', isTextBox: true,
  };
  const shadow = box.textShadow.match(/^rgba?\(([^)]+)\)\s+([-\d.]+)px\s+([-\d.]+)px\s+([\d.]+)px/);
  if (shadow) {
    const [x, y, blur] = shadow.slice(2).map(Number);
    const channels = shadow[1].split(',').map(Number);
    options.shadow = {
      type: 'outer', color: cssColorToHex(`rgb(${channels.slice(0, 3).join(',')})`),
      opacity: channels[3] ?? 1, angle: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
      offset: Math.hypot(x, y) * points, blur: blur * points,
    };
  }
  return options;
}

module.exports = { textOptions, cssColorToHex };
