import test from "node:test";
import assert from "node:assert/strict";
import { chunkText, prepareParts, reconstructNonWhitespace } from "../src/livestream/chunking.mjs";

const measure = (text, size) => Array.from(text).length * size;
const options = { measure, maxWidth: 420, maxLines: 1, fontSize: 30, minFontSize: 20, fontWeight: 700 };

test("prefers Arabic and Western punctuation near the fitting tail", () => {
  const arabic = chunkText("سلام، عليكم؛ كيف الحال؟ بخير جدا", options);
  assert.equal(arabic[0].lines[0], "سلام، عليكم؛");
  assert.equal(arabic.map(part => part.lines.join(" ")).join(" ").replace(/\s/g, ""), "سلام،عليكم؛كيفالحال؟بخيرجدا");
  const western = chunkText("One phrase, then this. Last words", options);
  assert.match(western[0].lines[0], /[,.]$/);
});

test("never uses punctuation inside a token as a split boundary", () => {
  const decimal = chunkText("الرقم 1.5 محفوظ ثم نهاية", { ...options, maxWidth: 240 });
  assert.ok(decimal.some(part => part.lines[0].includes("1.5")));
  const quoted = chunkText("قال: «نعم.» ثم أكمل الكلام", { ...options, maxWidth: 330 });
  assert.ok(quoted[0].lines[0].endsWith(".»"));
});

test("preserves diacritics, mixed digits, and source ranges", () => {
  const source = "فِي الْبَدْءِ 2026 كانَتِ الكَلِمَةُ، وَالكَلِمَةُ كَانَتْ عِنْدَ اللهِ";
  const parts = prepareParts({ text: source, sourceId: "يو-1", kind: "bible", parentType: "verse", parentNumber: 1, reference: "يوحنا ١:١", options });
  assert.equal(reconstructNonWhitespace(source, parts), source.replace(/\s/g, ""));
  assert.equal(parts[0].reference, "يوحنا ١:١");
  assert.ok(parts.every((part, index) => part.partIndex === index + 1 && part.partCount === parts.length));
});

test("supports punctuation-free long text and groups two authored lines", () => {
  const source = "واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية\nتسعة عشرة أحد عشر";
  const parts = chunkText(source, { ...options, maxLines: 2, maxWidth: 240 });
  assert.ok(parts.length > 1);
  assert.ok(parts.every(part => part.lines.length <= 2));
  assert.equal(reconstructNonWhitespace(source, parts), source.replace(/\s/g, ""));
});

test("empty text produces no parts", () => assert.deepEqual(chunkText("  \n ", options), []));

test("oversized single word shrinks only to the readable minimum", () => {
  const parts = chunkText("abcdefghij", { ...options, maxWidth: 240 });
  assert.equal(parts[0].fontSize, 24);
  assert.throws(() => chunkText("abcdefghij", { ...options, maxWidth: 190 }), /أعرض من مساحة العرض/);
});

test("repeated chorus identities remain distinct", () => {
  const first = prepareParts({ text: "قرار ثابت", sourceId: "song:1:chorus:0", kind: "song", parentType: "chorus", parentNumber: null, options });
  const repeated = prepareParts({ text: "قرار ثابت", sourceId: "song:1:chorus:repeat:2", kind: "song", parentType: "chorus", parentNumber: null, options });
  assert.notEqual(first[0].id, repeated[0].id);
});
