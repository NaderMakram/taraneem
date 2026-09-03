const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

export function normalizeDigits(value) {
  return String(value ?? "").replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
    const codePoint = digit.codePointAt(0);
    const zero = codePoint <= 0x0669
      ? ARABIC_INDIC_ZERO
      : EXTENDED_ARABIC_INDIC_ZERO;

    return String(codePoint - zero);
  });
}

export function isSupportedDigit(value) {
  return typeof value === "string" && /^[0-9\u0660-\u0669\u06F0-\u06F9]$/.test(value);
}

export function containsSupportedDigit(value) {
  return /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(String(value ?? ""));
}

export function parseBibleReferenceQuery(value) {
  const normalized = normalizeDigits(value).trim().replace(/\s+/g, " ");
  const numberMatches = [...normalized.matchAll(/\d+/g)];
  const firstLetterIndex = normalized.search(/[A-Za-z\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u0750-\u077F\u08A0-\u08FF]/);
  const firstNumber = numberMatches[0];
  const hasLeadingSeries = Boolean(
    firstNumber &&
    firstLetterIndex !== -1 &&
    firstNumber.index < firstLetterIndex
  );

  const leadingSeries = hasLeadingSeries ? Number(firstNumber[0]) : null;
  const referenceNumbers = numberMatches
    .slice(hasLeadingSeries ? 1 : 0)
    .map((match) => Number(match[0]));
  const bookTerm = normalized
    .replace(/\d+/g, " ")
    .replace(/[:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    normalized,
    bookTerm,
    hasDigits: numberMatches.length > 0,
    leadingSeries,
    referenceNumbers,
  };
}

function createInterpretation(series, numbers, isSingleChapter) {
  if (numbers.length === 0) {
    return { series, chapter: null, verse: null };
  }

  if (numbers.length === 1 && isSingleChapter) {
    return { series, chapter: 1, verse: numbers[0] };
  }

  return {
    series,
    chapter: numbers[0],
    verse: numbers.length > 1 ? numbers[1] : null,
  };
}

export function getReferenceInterpretations(parsedQuery, isSingleChapter = false) {
  const { leadingSeries, referenceNumbers } = parsedQuery;

  if (leadingSeries !== null) {
    if (referenceNumbers.length > 2) return [];
    return [createInterpretation(leadingSeries, referenceNumbers, isSingleChapter)];
  }

  if (referenceNumbers.length === 0) {
    return isSingleChapter
      ? [createInterpretation(null, [], true)]
      : [];
  }

  if (referenceNumbers.length === 1) {
    return [createInterpretation(null, referenceNumbers, isSingleChapter)];
  }

  if (referenceNumbers.length === 2) {
    return [
      // Existing syntax: "book chapter verse".
      createInterpretation(null, referenceNumbers, false),
      // New syntax: "book series chapter". For a one-chapter numbered
      // book, the last number is the verse instead.
      createInterpretation(referenceNumbers[0], [referenceNumbers[1]], isSingleChapter),
    ];
  }

  if (referenceNumbers.length === 3) {
    return [
      createInterpretation(referenceNumbers[0], referenceNumbers.slice(1), false),
    ];
  }

  return [];
}

export function getBookSeries(chapter) {
  const match = String(chapter?.chapter_book_short ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function interpretationMatchesChapter(interpretation, chapter) {
  if (
    interpretation.series !== null &&
    interpretation.series !== getBookSeries(chapter)
  ) {
    return false;
  }

  if (
    interpretation.chapter !== null &&
    Number(chapter.chapter_number) !== interpretation.chapter
  ) {
    return false;
  }

  if (
    interpretation.verse !== null &&
    !Object.prototype.hasOwnProperty.call(
      chapter.verses ?? {},
      String(interpretation.verse)
    )
  ) {
    return false;
  }

  return true;
}

export function findSingleChapterBookShorts(chapters) {
  const chapterNumbersByBook = new Map();

  for (const chapter of chapters ?? []) {
    const shortName = chapter.chapter_book_short;
    if (!chapterNumbersByBook.has(shortName)) {
      chapterNumbersByBook.set(shortName, new Set());
    }
    chapterNumbersByBook.get(shortName).add(Number(chapter.chapter_number));
  }

  return new Set(
    [...chapterNumbersByBook]
      .filter(([, chapterNumbers]) => chapterNumbers.size === 1 && chapterNumbers.has(1))
      .map(([shortName]) => shortName)
  );
}
