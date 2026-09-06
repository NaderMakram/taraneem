const SENTENCE = new Set([".", "!", "?", "؟", "…"]);
const CLAUSE = new Set([",", "،", ";", "؛", ":"]);

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function trimRange(text, start, end) {
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return { start, end };
}

function boundaryCandidates(text, start) {
  const result = [];
  for (let index = start + 1; index <= text.length; index += 1) {
    const current = text[index - 1];
    const next = text[index];
    if (index === text.length || /\s/u.test(next || "") || /\s/u.test(current)) result.push(index);
  }
  return result;
}

function punctuationBefore(text, boundary) {
  let index = boundary - 1;
  const closers = new Set(["\"", "'", "»", "”", "’", ")", "]"]);
  while (index >= 0 && closers.has(text[index])) index -= 1;
  return text[index];
}

function chooseBoundary(text, start, fitting, candidates) {
  const floor = start + Math.floor((fitting - start) * 0.6);
  const preferred = (set) => {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const boundary = candidates[index];
      if (boundary <= fitting && boundary >= floor && set.has(punctuationBefore(text, boundary))) return boundary;
    }
    return null;
  };
  return preferred(SENTENCE) || preferred(CLAUSE) || fitting;
}

function splitLine(text, start, end, options) {
  const parts = [];
  let cursor = start;
  while (cursor < end) {
    while (cursor < end && /\s/u.test(text[cursor])) cursor += 1;
    if (cursor >= end) break;
    const candidates = boundaryCandidates(text.slice(0, end), cursor);
    let fitting = null;
    for (const candidate of candidates) {
      const range = trimRange(text, cursor, candidate);
      if (options.measure(text.slice(range.start, range.end), options.fontSize, options.fontWeight) <= options.maxWidth) {
        fitting = candidate;
      } else break;
    }
    if (fitting == null) {
      const nextWhitespace = text.slice(cursor, end).search(/\s/u);
      const tokenEnd = nextWhitespace < 0 ? end : cursor + nextWhitespace;
      const token = text.slice(cursor, tokenEnd);
      const width = options.measure(token, options.fontSize, options.fontWeight);
      const requiredSize = Math.floor(options.fontSize * options.maxWidth / width);
      if (!Number.isFinite(requiredSize) || requiredSize < options.minFontSize) {
        throw new Error(`الكلمة «${token.slice(0, 40)}» أعرض من مساحة العرض حتى عند أصغر حجم`);
      }
      parts.push({ ...trimRange(text, cursor, tokenEnd), fontSize: requiredSize });
      cursor = tokenEnd;
      continue;
    }
    const selected = chooseBoundary(text, cursor, Math.min(fitting, end), candidates);
    const range = trimRange(text, cursor, selected);
    parts.push({ ...range, fontSize: options.fontSize });
    cursor = selected;
  }
  return parts;
}

export function chunkText(text, options) {
  if (typeof text !== "string" || text.trim() === "") return [];
  if (!options || typeof options.measure !== "function" || !(options.maxWidth > 0) ||
      ![1, 2].includes(options.maxLines)) throw new Error("إعدادات تقسيم النص غير صالحة");
  const logicalLines = [];
  let start = 0;
  for (let index = 0; index <= text.length; index += 1) {
    if (index === text.length || text[index] === "\n") {
      logicalLines.push(...splitLine(text, start, index, options));
      start = index + 1;
    }
  }
  const chunks = [];
  for (let index = 0; index < logicalLines.length; index += options.maxLines) {
    const lines = logicalLines.slice(index, index + options.maxLines);
    chunks.push({
      sourceStart: lines[0].start,
      sourceEnd: lines[lines.length - 1].end,
      lines: lines.map(line => text.slice(line.start, line.end)),
      fontSize: Math.min(...lines.map(line => line.fontSize)),
    });
  }
  return chunks;
}

export function prepareParts({ text, sourceId, kind, parentType, parentNumber, reference, options }) {
  const chunks = chunkText(text, options);
  return chunks.map((chunk, index) => ({
    id: `${sourceId}:${parentType}:${parentNumber ?? "heading"}:${chunk.sourceStart}-${chunk.sourceEnd}:${hash(text)}`,
    sourceId,
    kind,
    parentType,
    parentNumber: parentNumber == null ? null : String(parentNumber),
    partIndex: index + 1,
    partCount: chunks.length,
    reference: reference || null,
    ...chunk,
  }));
}

export function reconstructNonWhitespace(text, parts) {
  return parts.map(part => text.slice(part.sourceStart, part.sourceEnd)).join("").replace(/\s/gu, "");
}
