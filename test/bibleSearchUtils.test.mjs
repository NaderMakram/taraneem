import assert from "node:assert/strict";
import { test } from "node:test";

import {
  containsSupportedDigit,
  findSingleChapterBookShorts,
  getReferenceInterpretations,
  interpretationMatchesChapter,
  isSupportedDigit,
  normalizeDigits,
  parseBibleReferenceQuery,
} from "../src/helpers/bibleSearchUtils.mjs";

const JOHN = "\u064A\u0648";
const CORINTHIANS = "\u0643\u0648";
const JUDE = "\u064A\u0647";

test("normalizes both Arabic digit sets for internal use", () => {
  assert.equal(normalizeDigits(`${JOHN} \u0664 \u0661\u0666`), `${JOHN} 4 16`);
  assert.equal(normalizeDigits(`${JOHN} \u06F4 \u06F1\u06F6`), `${JOHN} 4 16`);
  assert.equal(isSupportedDigit("\u0664"), true);
  assert.equal(isSupportedDigit("\u06F4"), true);
  assert.equal(isSupportedDigit("4"), true);
  assert.equal(isSupportedDigit(JOHN[0]), false);
  assert.equal(containsSupportedDigit(`${JOHN} \u0664`), true);
});

test("parses leading and trailing numbered-book syntax", () => {
  assert.deepEqual(parseBibleReferenceQuery(`\u0661 ${CORINTHIANS} \u0661\u0663 \u0664`), {
    normalized: `1 ${CORINTHIANS} 13 4`,
    bookTerm: CORINTHIANS,
    hasDigits: true,
    leadingSeries: 1,
    referenceNumbers: [13, 4],
  });

  assert.deepEqual(parseBibleReferenceQuery(`${CORINTHIANS} \u0661 \u0661\u0663 \u0664`), {
    normalized: `${CORINTHIANS} 1 13 4`,
    bookTerm: CORINTHIANS,
    hasDigits: true,
    leadingSeries: null,
    referenceNumbers: [1, 13, 4],
  });
});

test("combines normal and trailing numbered-book meanings for two numbers", () => {
  const parsed = parseBibleReferenceQuery(`${CORINTHIANS} \u0661 \u0661\u0663`);

  assert.deepEqual(getReferenceInterpretations(parsed, false), [
    { series: null, chapter: 1, verse: 13 },
    { series: 1, chapter: 13, verse: null },
  ]);
});

test("uses the first of three trailing numbers as the book series", () => {
  const parsed = parseBibleReferenceQuery(`${CORINTHIANS} 1 13 4`);

  assert.deepEqual(getReferenceInterpretations(parsed, false), [
    { series: 1, chapter: 13, verse: 4 },
  ]);
});

test("treats one number as a verse for a single-chapter book", () => {
  const jude = {
    chapter_book_short: JUDE,
    chapter_number: 1,
    verses: { "5": "example" },
  };
  const [interpretation] = getReferenceInterpretations(
    parseBibleReferenceQuery(`${JUDE} \u0665`),
    true
  );

  assert.deepEqual(interpretation, { series: null, chapter: 1, verse: 5 });
  assert.equal(interpretationMatchesChapter(interpretation, jude), true);
});

test("applies the single-chapter rule after a trailing book-series number", () => {
  const secondJohn = {
    chapter_book_short: `2${JOHN}`,
    chapter_number: 1,
    verses: { "5": "example" },
  };
  const interpretations = getReferenceInterpretations(
    parseBibleReferenceQuery(`${JOHN} \u0662 \u0665`),
    true
  );

  assert.deepEqual(interpretations[1], { series: 2, chapter: 1, verse: 5 });
  assert.equal(interpretationMatchesChapter(interpretations[1], secondJohn), true);
});

test("derives single-chapter books from the bundled metadata shape", () => {
  const chapters = [
    { chapter_book_short: JUDE, chapter_number: 1 },
    { chapter_book_short: "\u062A\u0643", chapter_number: 1 },
    { chapter_book_short: "\u062A\u0643", chapter_number: 2 },
  ];

  assert.deepEqual([...findSingleChapterBookShorts(chapters)], [JUDE]);
});
